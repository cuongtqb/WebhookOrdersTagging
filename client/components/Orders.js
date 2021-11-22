import React, { useCallback, useState } from 'react';
import { Heading, Page, Card, Tabs, Button, TextField } from "@shopify/polaris";
import axios from "axios";

const OrderTagging = () => {
    return (
        <>
            <div style={{ display: "inline-block", marginRight: "15px" }}>
                order tag
            </div>
            <div
                style={{
                    width: "200px",
                    display: "inline-block",
                    marginRight: "15px"
                }}
            >
                <TextField
                    // value={}
                    // onChange={}
                    autoComplete="off"
                />
            </div>
            <div style={{ display: "inline-block" }}>
                <Button outline>
                    Search
                </Button>
            </div>
        </>
    )
}

export default OrderTagging;