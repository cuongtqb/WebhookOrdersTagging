import React, { useCallback, useEffect, useState } from 'react';
import { Heading, Page, Button, TextField, Toast, Frame } from "@shopify/polaris";
import axios from "axios";

const Setting = () => {
    const [data, setData] = useState({ _id: '', totalPrice: 0, tag: '' });
    const [active, setActive] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = useCallback(async () => {
        const getSetting = await axios.get('/setting');
        if (getSetting?.data && getSetting?.status === 200) {
            setData({ ...data, ...getSetting.data });
        }
    }, [data._id])

    function handleChange(name, value) {
        setData({
            ...data,
            [name]: value
        });
    };

    const toastMarkup = active ? (
        <Toast
            content="Save success"
            duration={3000}
            onDismiss={() => setActive(!active)}
        />
    ) : null;

    const handleSave = async () => {
        console.log("handleSave", data);
        const created = await axios.put('/setting', data);
        if (created) {
            console.log("created", created);
            if (created.status === 200) {
                console.log("change active");
                setActive((active) => !active);
            }
            fetchData();

        }

    }

    return (

        <div style={{ width: '70%' }}>
            <div style={{ height: '50px' }}>
                <div style={{ display: "inline-block" }}>When the total price of the order greater than</div>
                <div style={{
                    width: "200px",
                    display: "inline-block",
                    float: 'right'
                }}>
                    {console.log('data.totalPrice', data?.totalPrice)}
                    <TextField
                        value={data?.totalPrice.toString()}
                        name='totalPrice'
                        onChange={val => handleChange('totalPrice', val)}
                        autoComplete="off"
                    />
                </div>
            </div>
            <div style={{ height: '50px' }}>
                <div style={{ display: "inline-block" }}>Apply this tag to the order</div>
                <div style={{
                    width: "200px",
                    display: "inline-block",
                    float: 'right'
                }}>
                    <TextField
                        value={data['tag']}
                        name='tag'
                        onChange={val => handleChange('tag', val)}
                        autoComplete="off"
                    />
                </div>
            </div>
            <div style={{ height: '50px' }}>
                <div style={{ float: 'right' }}>
                    <Frame>
                        <Button outline disabled={!data.totalPrice || !data.tag} onClick={handleSave}>
                            Save
                        </Button>
                        {toastMarkup}
                    </Frame>
                </div>
            </div>
        </div >
    )
}

export default Setting;