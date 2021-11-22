import React, { useCallback, useState } from 'react';
import { Heading, Page, Card, Tabs, Button, TextField } from "@shopify/polaris";
import axios from "axios";
import Setting from './Setting';
import OrderTagging from './Orders';

const Index = () => {
  const [selected, setSelected] = useState(0);
  const [value, setValue] = useState('');


  const handleTabChange = useCallback(
    (selectedTabIndex) => setSelected(selectedTabIndex),
    [],
  );

  const handleChange = useCallback((newValue) => setValue(newValue), []);

  const handleSearch = async () => {
    const data = await axios.get(
      "/listOrder",
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "*",
          "Access-Control-Allow-Headers": "'Access-Control-Allow-Headers: Origin, Content-Type, X-Auth-Token'",
        }
      }
    );
    // const data = await client.get({
    //   path: 'orders',
    //   query: { "status": "any" },
    // });
    console.log(data);
    console.log(data.data);
  };

  const tabs = [
    {
      id: 'all-customers-fitted-2',
      content: 'Orders',
      accessibilityLabel: 'All customers',
      panelID: 'all-customers-fitted-content-2',
    },
    {
      id: 'accepts-marketing-fitted-2',
      content: 'Settings',
      panelID: 'accepts-marketing-fitted-Ccontent-2',
    },
  ];

  return (

    <Page title='Order Tagger'>
      <Card>
        <Tabs tabs={tabs} selected={selected} onSelect={handleTabChange}>
          <Card.Section title={tabs[selected].content}>
            {selected === 1 ? <Setting /> : <OrderTagging />}
          </Card.Section>
        </Tabs>
      </Card>
    </Page>
  );
};

export default Index;
