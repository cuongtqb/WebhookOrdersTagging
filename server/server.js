import "@babel/polyfill";
import dotenv from "dotenv";
import Shopify, { ApiVersion } from "@shopify/shopify-api";
import Koa from "koa";
import Router from "koa-router";
import koaWebpack from "koa-webpack";
import serveStatic from "koa-static";
import fs from "fs";
import path from "path";
import verifyRequest from "./middlewares/verifyRequest";
import mongoose from 'mongoose';
import bodyParser from 'koa-bodyparser';
import {
  storeCallback,
  loadCallback,
  deleteCallback
} from './customSessionStorage'
import Setting from './models/setting.js';
import Session from './models/session.js';


dotenv.config();

const port = parseInt(process.env.PORT, 10) || 8081;
const webpackConfig = require("../webpack.config.js");
const dev = process.env.NODE_ENV !== "production";

Shopify.Context.initialize({
  API_KEY: process.env.SHOPIFY_API_KEY,
  API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
  SCOPES: process.env.SCOPES.split(","),
  HOST_NAME: process.env.HOST.replace(/https:\/\//, ""),
  API_VERSION: ApiVersion.Unstable,
  IS_EMBEDDED_APP: true,
  SESSION_STORAGE: new Shopify.Session.CustomSessionStorage(storeCallback, loadCallback, deleteCallback),
});

const ACTIVE_SHOPIFY_SHOPS = {};
Shopify.Webhooks.Registry.addHandler("APP_UNINSTALLED", {
  path: "/webhooks",
  webhookHandler: async (topic, shop, body) => {
    delete ACTIVE_SHOPIFY_SHOPS[shop];
    console.log("webhookHandler", body);
  }
});

Shopify.Webhooks.Registry.addHandler("PRODUCTS_CREATE", {
  path: "/products",
  webhookHandler: async (topic, shop, body) => {
    delete ACTIVE_SHOPIFY_SHOPS[shop];
  }
});

Shopify.Webhooks.Registry.addHandler("ORDERS_CREATE", {
  path: "/orders",
  webhookHandler: async (topic, shop, body) => {
    const getSession = await Session.findOne({ shop });
    delete ACTIVE_SHOPIFY_SHOPS[shop];
    const newBody = JSON.parse(body);
    const totalPrice = parseInt(newBody.total_price);
    const settingTag = await Setting.findOne();
    if (settingTag?.totalPrice) {
      if (totalPrice >= settingTag.totalPrice) {
        if (getSession?.shop && getSession?.accessToken) {
          const client = new Shopify.Clients.Graphql(getSession.shop, getSession.accessToken);
          const updateOrder = await client.query({
            data: {
              query: `mutation 
              orderUpdate($input: OrderInput!) {
                orderUpdate(input: $input) {
                  userErrors {
                    field
                    message
                  }
                  order {
                    id
                    tags
                  }
                }
              }
              `,
              variables: {
                input: {
                  "id": `gid://shopify/Order/${newBody.id}`,
                  "tags": [`${settingTag.tag}`]
                }
              }
            }
          });
        }
      }
    }
  }
});

function renderView(file, vars) {
  let content = fs.readFileSync(path.join(__dirname, "views", `${file}.html`), {
    encoding: "utf-8",
  });

  Object.keys(vars).forEach((key) => {
    const regexp = new RegExp(`{{ ${key} }}`, "g");
    content = content.replace(regexp, vars[key] || "");
  });

  return content;
}

const TOP_LEVEL_OAUTH_COOKIE = "shopify_top_level_oauth";
const USE_ONLINE_TOKENS = true;
const listPath = ['/webhooks', '/orders', '/products'];

async function createAppServer() {
  const server = new Koa();
  const router = new Router();
  server.keys = [Shopify.Context.API_SECRET_KEY];
  server.use(async (ctx, next) => {
    if (listPath.includes(ctx.path)) ctx.disableBodyParser = true;
    await next();
  });
  server.use(bodyParser());


  const urlMongo = process.env.MONGODB_URL;
  const connectionParams = {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }
  mongoose.connect(urlMongo, connectionParams);
  const db = mongoose.connection;
  db.on("error", console.error.bind(console, "connection error: "));
  db.once("open", function () {
    console.log("Connected successfully");
  });


  let middleware;
  if (dev) {
    middleware = await koaWebpack({
      config: { ...webpackConfig, mode: process.env.NODE_ENV },
    });
    server.use(middleware);
  }

  router.get("/auth/toplevel", async (ctx) => {
    ctx.cookies.set(TOP_LEVEL_OAUTH_COOKIE, "1", {
      signed: true,
      httpOnly: true,
      sameSite: "strict",
    });

    ctx.response.type = "text/html";
    ctx.response.body = renderView("top_level", {
      apiKey: Shopify.Context.API_KEY,
      hostName: Shopify.Context.HOST_NAME,
      shop: ctx.query.shop,
    });
  });

  router.get("/auth", async (ctx) => {
    if (!ctx.cookies.get(TOP_LEVEL_OAUTH_COOKIE)) {
      ctx.redirect(`/auth/toplevel?shop=${ctx.query.shop}`);
      return;
    }

    const redirectUrl = await Shopify.Auth.beginAuth(
      ctx.req,
      ctx.res,
      ctx.query.shop,
      "/auth/callback",
      USE_ONLINE_TOKENS
    );

    ctx.redirect(redirectUrl);
  });

  router.get("/auth/callback", async (ctx) => {
    try {
      const session = await Shopify.Auth.validateAuthCallback(
        ctx.req,
        ctx.res,
        ctx.query
      );

      const host = ctx.query.host;
      ACTIVE_SHOPIFY_SHOPS[session.shop] = session.scope;

      const [response, ordersCreateWebhook, productCreateWebhook] = await Promise.all([
        Shopify.Webhooks.Registry.register({
          shop: session.shop,
          accessToken: session.accessToken,
          topic: "APP_UNINSTALLED",
          path: "/webhooks",
        }),
        Shopify.Webhooks.Registry.register({
          path: '/orders',
          topic: 'ORDERS_CREATE',
          shop: session.shop,
          accessToken: session.accessToken
        }),
        Shopify.Webhooks.Registry.register({
          path: '/products',
          topic: 'PRODUCTS_CREATE',
          shop: session.shop,
          accessToken: session.accessToken
        })
      ])

      if (!response["APP_UNINSTALLED"].success) {
        console.log(
          `Failed to register APP_UNINSTALLED webhook: ${response.result}`
        );
      }
      if (!ordersCreateWebhook["ORDERS_CREATE"]?.success) {
        console.log(
          `Failed to register ORDERS_CREATE webhook: ${ordersCreateWebhook.result}`
        );
      }
      if (!productCreateWebhook["PRODUCTS_CREATE"]?.success) {
        console.log(
          `Failed to register PRODUCTS_CREATE webhook: ${productCreateWebhook.result}`
        );
      }


      ctx.redirect(`/?shop=${session.shop}&host=${host}`);
    } catch (e) {
      switch (true) {
        case e instanceof Shopify.Errors.InvalidOAuthError:
          ctx.throw(400, e.message);
          break;
        case e instanceof Shopify.Errors.CookieNotFound:
        case e instanceof Shopify.Errors.SessionNotFound:
          ctx.redirect(`/auth?shop=${ctx.query.shop}`);
          break;
        default:
          ctx.throw(500, e.message);
          break;
      }
    }
  });

  router.post("/webhooks", async (ctx) => {
    try {
      await Shopify.Webhooks.Registry.process(ctx.req, ctx.res);
      console.log(`Webhook processed, returned status code 200`);
    } catch (error) {
      console.log(`Failed to process webhook: ${error}`);
    }
  });

  router.post("/products", async (ctx) => {
    try {
      await Shopify.Webhooks.Registry.process(ctx.req, ctx.res);
      console.log(`Webhook processed products, returned status code 200`);
    } catch (error) {
      console.log(`Failed to process webhook: ${error}`);
    }
  });

  router.post("/orders", async (ctx) => {
    try {
      await Shopify.Webhooks.Registry.process(ctx.req, ctx.res);
      console.log("/webhooks orders", ctx)
      console.log(`Webhook processed orders, returned status code 200`);
    } catch (error) {
      console.log(`Failed to process webhook: ${error}`);
    }
  });

  router.put('/setting', async (ctx) => {
    try {
      const { _id, totalPrice, tag } = ctx.request.body;
      let setting;
      if (!_id) {
        setting = await Setting.create({ totalPrice, tag });
      }
      else {
        setting = await Setting.updateOne({ _id }, { $set: { totalPrice, tag } }, { upsert: true });
      }
      ctx.status = 200;
      ctx.response.body = setting;
    } catch (error) {
      console.log("Create Setting error", error);
    }
  })

  router.get('/setting', async (ctx) => {
    try {
      ctx.status = 200;
      const setting = await Setting.findOne();
      if (setting) {
        return ctx.response.body = setting;
      }
      return ctx.response.body = null;
    } catch (error) {
      console.log("Get Setting error", error);
    }
  })



  router.post(
    "/graphql",
    verifyRequest({ isOnline: USE_ONLINE_TOKENS, returnHeader: true }),
    async (ctx, next) => {
      await Shopify.Utils.graphqlProxy(ctx.req, ctx.res);
    }
  );

  if (!dev) {
    server.use(serveStatic(path.resolve(__dirname, "../dist")));
  }
  router.get("(.*)", async (ctx) => {
    const shop = ctx.query.shop;

    if (ACTIVE_SHOPIFY_SHOPS[shop] === undefined) {
      ctx.redirect(`/auth?shop=${shop}`);
    } else {
      ctx.response.type = "html";
      if (dev) {
        ctx.response.body = middleware.devMiddleware.fileSystem.createReadStream(
          path.resolve(webpackConfig.output.path, "index.html")
        );
      } else {
        ctx.response.body = fs.readFileSync(
          path.resolve(__dirname, "../dist/client/index.html")
        );
      }
    }
  });



  server.use(router.allowedMethods());
  server.use(router.routes());
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
}

createAppServer();