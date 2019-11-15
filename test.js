/* refactoring test code */
const fs = require('fs');
const mysql = require('mysql');
const db = require('./dbutil');
const	config = require(__dirname + '/config');
config.ssl = {
        ca: fs.readFileSync(config.cacert)
};


// SQL Statement
const DELETE_ORDER_DETAILS = 'delete from order_details where ord_id=?';
const CREATE_ORDER_DETAILS = 'insert into order_details (ord_desc, quantity, ord_id) values ?';

const deleteOrderDetails = db.mkQuery(DELETE_ORDER_DETAILS);
const createOrderDetails = db.mkQuery(CREATE_ORDER_DETAILS);

const pool = mysql.createPool(config);

// Test data
const editOrder = 14;
const newOrderSample = [
    ['purple_leg','3'],
    ['green_hand','2'],
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
            .then(db.commit)
            .catch(db.rollback)
            .finally (() => {
                console.info('all done');
                conn.release();
                process.exit(1);
            })
    }   // getConnection
)
