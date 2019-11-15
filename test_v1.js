const fs = require('fs');
const mysql = require('mysql');
//const config = require('./config');

const	config = require(__dirname + '/config');
config.ssl = {
        ca: fs.readFileSync(config.cacert)
};

// SQL Statement
const CREATE_ORDER = 'insert into orders(order_date, email) values (?,?)';
const GET_NEW_ORDER_ID = 'select last_insert_id() as ord_id from orders';
const CREATE_ORDER_DETAILS = 'insert into order_details (ord_desc, quantity, ord_id) values ?';

const pool = mysql.createPool(config);

// Test data
const newOrder = [ new Date(), 'fred@abc.com'];
const newOrderSample = [
    ['apple','10'],
    ['orange','20'],
    ['grape','5']
];

// Get a conection
pool.getConnection(
    (err, conn) => {
        if (err)
            throw err
        // Start transaction
        conn.beginTransaction(
            err => {
                if (err) {
                    conn.release();
                    throw err;
                }
                conn.query(CREATE_ORDER, newOrder, 
                    (err, result)=>{
                        if (err){
                            conn.rollback();
                            conn.release();
                            throw err;
                        }
                        console.info('result: ', result);

                        conn.query(GET_NEW_ORDER_ID, 
                            (err, result) => {
                                if (err) {
                                    conn.rollback();
                                    conn.release();
                                    throw err;
                                }
                                console.info ('result: ', result);
                                const newOrderId = result[0].ord_id;
                                console.info('before order details: ', newOrderId );
                                const newOrderDetails = newOrderSample.map(
                                    v => {
                                        v.push(newOrderId);
                                        return (v);
                                    }
                                )
                                
                                console.info ('after newOrderDetails: ', newOrderDetails);
                                conn.query(CREATE_ORDER_DETAILS, [ newOrderDetails ], 
                                    (err, result)=>{
                                        if (err) {
                                            conn.rollback();
                                            conn.release();
                                            throw err;
                                        }
                                        console.info('result:', result);
                                        //conn.rollback();
                                        console.info('commiting... result...');
                                        conn.commit(
                                            err => {
                                                if (err) {
                                                    conn.rollback();
                                                    conn.release();
                                                    throw err;
                                                }
                                                conn.release();
                                                process.exit(0);
                                            }
                                        ) // commit

                                        //conn.release();

                                    } 
                                ) //CREATE_ORDER_DETAILS

                                //conn.rollback();
                                //conn.release();
                            } // GET_NEW_ORDER_ID
                        )

                        //conn.rollback();
                        //conn.release();

                    } // CREATE_ORDER
                )
            } //beginTransaction
        )
    }   // getConnection
)
