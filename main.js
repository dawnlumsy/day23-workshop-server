// Load libraries
const fs = require('fs');
const express = require('express');
const mysql = require('mysql');
const morgan = require('morgan');
const db = require('./dbutil');
/*const config = require('./config');

config.ssl = {
    ca: fs.readFileSync(config.cacert)
}*/

let config;

if (fs.existsSync(__dirname + '/config.js')) {
	config = require(__dirname + '/config');
	config.ssl = {
		 ca: fs.readFileSync(config.cacert)
	};
} else {
    console.info('using env');
	config = {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: 'myshop',
        connectionLimit: 4,
        ssl: {
            ca: process.env.DB_CA
        }
    };
}


// configurations
const pool = mysql.createPool(config);
const PORT = parseInt(process.argv[2] || process.env.APP_PORT || process.env.PORT) || 3000;

// SQL Statement
const CREATE_ORDER = 'insert into orders(order_date, email) values (?,?)';
const GET_NEW_ORDER_ID = 'select last_insert_id() as ord_id from orders';
const CREATE_ORDER_DETAILS = 'insert into order_details (ord_desc, quantity, ord_id) values ?';
const GET_ALL_ORDERS = 'select * from orders';
const FIND_ORDER_BY_ID = 'select * from orders o join order_details od on o.ord_id = od.ord_id and o.ord_id = ?';
const DELETE_ORDER_DETAILS = 'delete from order_details where ord_id=?';

const createOrder = db.mkQuery(CREATE_ORDER);
const getNewOrderId = db.mkQuery(GET_NEW_ORDER_ID);
const createOrderDetails = db.mkQuery(CREATE_ORDER_DETAILS);
const deleteOrderDetails = db.mkQuery(DELETE_ORDER_DETAILS);

const getAllOrders = db.mkQueryFromPool(db.mkQuery(GET_ALL_ORDERS), pool);
const getOrderByOrderId = db.mkQueryFromPool(db.mkQuery(FIND_ORDER_BY_ID),pool);


const app = express();
app.use(morgan('combined'));


app.get('/api/orders',
	(req, resp) => {
		getAllOrders()
			.then(result => {
				resp.status(200).type('application/json').json(result)
			})
			.catch(error => {
				resp.status(400).type('application/json').json({ error })
			})
	}
);

app.get('/api/order/:orderId', 
    (req, resp)=>{
        const orderId = parseInt(req.params.orderId);
        getOrderByOrderId([ orderId ])
            .then(result => {
                if (result.length <= 0)
                    return resp.status(404).type('application/json').json({});
                const order = {
                    email: result[0].email,
                    ord_id: result[0].ord_id,
                    orderDetails: []
                }
                order.orderDetails = result.map(v=> {
                    return {
                        ord_details_id: v.ord_details_id,
                        description: v.ord_desc,
                        quantity: v.quantity
                    }
                });
                resp.status(200).type('application/json').json(order)
            })
            .catch(error => {
                resp.status(400).type('application/json').json({ error })
            })
    }
);
/*
{ ord_id: 14,
  email: 'dawnlum@hotmail.com',
  orderDetails: [
    { description: 'purple', quantity: 2 },
    { description: 'green', quantity: 1 }
  ]}
*/

app.post('/api/order/:orderId', express.json(),
    (req, resp) => {
        console.info("request body:", req.body);
        //console.info("request params:", req.params);

        const editOrder = req.body.ord_id;
        const newOrder = [ editOrder, req.body.email];
        const newOrderSample = req.body.orderDetails.map(v=> [v.description, v.quantity]);

        console.info("editOrder:", editOrder);
        console.info("newOrder:", newOrder);
        console.info("newOrderSample:", newOrderSample);

        //resp.status(201).json({});

        // Get a conection
        pool.getConnection(
            (err, conn) => {
                if (err)
                    throw err;
                // Start transaction
                // { connection, result, params, error }
                db.startTransaction(conn)
                    .then(status => {
                        //status.connection
                        return (
                            deleteOrderDetails({
                                connection: status.connection,
                                params: editOrder
                            })
                        )
                    })
                    //.then(getNewOrderId) // (status) => { }
                    .then(status => {
                        console.info('console: before getNewOrderId: ', status.result);
                        //const newOrderId = status.result[0].ord_id;
                        const newOrderId = editOrder;
                        const newOrderDetails = newOrderSample.map(
                            v => {
                                v.push(newOrderId);
                                return (v);
                            }
                        )
                        console.info('newOrderDetails: ', newOrderDetails);
                        return (
                            createOrderDetails({
                                connection: status.connection,
                                params: [ newOrderDetails ] 
                            })
                        )
                    })
                    .then(db.commit, db.rollback)
                    .then(
                        (status) => { resp.status(201).json({}); },
						(status) => { resp.status(400).json({ error: status.error }); }
                    )
                    .finally (() => { conn.release() })
            }   // getConnection
        )
    }
);

// POST /api/order, application/json
// req.body => 201
/* { email: 'fred@gmail.com',
 *     orderDetails: [
 *         { description: 'apple', quantity: '10' },
 *         { description: 'orange', quantity: '5' }
 *     ]} 
 */
app.post('/api/order', express.json(),
    (req, resp) => {
        console.info("request body:" , req.body);
        //const email = req.body.email;
        //const orderDetails = req.body.orderDetails;

        const newOrder = [ new Date(), req.body.email ];
        const newOrderSample = req.body.orderDetails.map(v => [v.description, v.quantity]);

        console.info("newOrder:", newOrder);
        console.info("newOrder:", newOrderSample);

        //resp.status(201).json({});
        pool.getConnection(
            (err, conn) => {
                if (err)
                    throw err;
                // Start transaction
                // { connection, result, params, error }
                db.startTransaction(conn)
                    .then(status => {
                        //status.connection
                        return (
                            createOrder({
                                connection: status.connection,
                                params: newOrder
                            })
                        )
                    })
                    //.then(getNewOrderId) // (status) => { }
                    .then(status => {
                        console.info('console: after getNewOrderId: ', status.result);
                        //const newOrderId = status.result[0].ord_id;
                        const newOrderId = status.result.insertId;
                        const newOrderDetails = newOrderSample.map(
                            v => {
                                v.push(newOrderId);
                                return (v);
                            }
                        );
                        return (
                            createOrderDetails({
                                connection: status.connection,
                                params: [ newOrderDetails ] 
                            })
                        )
                        //status.connection.rollback();
                        //process.exit(0);   
                    })
                    .then(db.commit, db.rollback)
                    .then(
                        (status) => { resp.status(201).json({}); },
                        (status) => { resp.status(400).json({ error: status.error }); }
                    )
                    .finally (() => { conn.release() })
            }   // getConnection
            
        )
    }
);

app.use(express.static(__dirname + '/public'));

pool.getConnection(
    (err, conn) => {
        if (err) {
            console.error('Cannot get database: ', err);
            return process.exit(0);
        }
        conn.ping((err) => {
            conn.release();
            if (err) {
                console.error('Cannot ping database: ', err);
                return process.exit(0);
            }
            app.listen(PORT, 
                ()=>{
                    console.info(`Application started on ${PORT} at ${new Date().toString()}`);
                }
            )
        })
    }
);