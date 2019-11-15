/* refactoring test code */
const fs = require('fs');
const mysql = require('mysql');
const db = require('./dbutil');
const	config = require(__dirname + '/config');
config.ssl = {
        ca: fs.readFileSync(config.cacert)
};

// SQL Statement
const CREATE_ORDER = 'insert into orders(order_date, email) values (?,?)';
const GET_NEW_ORDER_ID = 'select last_insert_id() as ord_id from orders';
const CREATE_ORDER_DETAILS = 'insert into order_details (ord_desc, quantity, ord_id) values ?';

const createOrder = db.mkQuery(CREATE_ORDER);
const getNewOrderId = db.mkQuery(GET_NEW_ORDER_ID);
const createOrderDetails = db.mkQuery(CREATE_ORDER_DETAILS);

const pool = mysql.createPool(config);

// Test data
const newOrder = [ new Date(), 'barney@gmail.com'];
const newOrderSample = [
    ['bannana','2'],
    ['pear','8'],
    ['mango','3']
];

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
                    createOrder({
                        connection: status.connection,
                        params: newOrder
                    })
                )
            })
            .then(getNewOrderId) // (status) => { }
            .then(status => {
                console.info('console: after getNewOrderId: ', status.result);
                const newOrderId = status.result[0].ord_id;
                const newOrderDetails = newOrderSample.map(
                    v => {
                        v.push(newOrderId);
                        return (v);
                    }
                )
                return (
                    createOrderDetails({
                        connection: status.connection,
                        params: [ newOrderDetails ] 
                    })
                ) 
            })
            .then(db.commit)
            .catch(db.rollback)
            .finally (() => {
                console.info('all done');
                conn.release();
                process.exit(1);
            })
    }   // getConnection
)
