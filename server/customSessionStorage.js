import { Session } from "@shopify/shopify-api/dist/auth/session";
const mongoose = require('mongoose');
const sessionStore = require('./models/session');

async function storeCallback(session) {
    try {
        console.log("storeCallback", session)
        await sessionStore.updateOne({ id: session.id }, { $set: session }, { upsert: true });
        debugger
        return true;
    } catch (error) {
        console.log("storeCallback error", error);
        return false;
    }
}

async function loadCallback(id) {
    try {
        const getSession = await sessionStore.findOne({ id });
        if (getSession) {
            let session = new Session();
            session.id = getSession.id;
            session.shop = getSession.shop;
            session.state = getSession.state;
            session.isOnline = getSession.isOnline;
            session.accessToken = getSession.accessToken;
            session.scope = getSession.scope;
            console.log("loadSession", session);
            return session;
        }
        return undefined;
    } catch (error) {
        console.log("loadCallback error", error);
        return undefined;
    }
}

async function deleteCallback(id) {
    try {
        await sessionStore.deleteOne({ id });
        return true;
    } catch (err) {
        console.log("deleteCallback", err);
        throw new Error(err)
    }
}

module.exports = {
    storeCallback,
    loadCallback,
    deleteCallback
}