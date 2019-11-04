import { NextFunction, Request, Response, Router } from "express";
import * as HttpStatus from "http-status-codes";
import { body, validationResult } from "express-validator/check";

var paypal = require('paypal-rest-sdk');
var mysql = require('mysql');
var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "bank"
});

const depositsRouter: Router = Router();

var client_id = 'Aeh8fpgAvTQlTWEgv_TfW-uFgTlt9rbcukRsNLDHSQuK72np4ce7V2MG4lScsCVHhBaO8XUDLeGWv7ar';
var secret = 'EC9RMBdgyGNpeYf4HNM1CIy4aIxO0qFLv0S4xP4PxIbAPgdctkA4H9ryB7rDK4M6xcQ7fW5XdM3-tuJL';
var userID='';
var depositsAmount='';
 
depositsRouter
  .route("/paypal")
  .get((req: Request, res: Response, next: NextFunction) => {
    try {
    	paypal.configure({
		    'mode': 'sandbox', //sandbox or live
		    'client_id': client_id,
		    'client_secret': secret
		});
		var payReq = JSON.stringify({
	        'intent':'sale',
	        'redirect_urls':{
	            'return_url':'http://localhost:8000/api/deposits/process',
	            'cancel_url':'http://localhost:8000/api/deposits/cancel',
	        },
	        'payer':{
	            'payment_method':'paypal'
	        },
	        'transactions':[{
	            'amount':{
	                'total':req.query['amount'],
	                'currency':req.query['currency']
	            },
	            'description':'This is the payment transaction description.'
	        }]
	    });
	    userID=req.query['userID'];
	    depositsAmount=req.query['amount'];
	    paypal.payment.create(payReq, function(error, payment){
	        if(error){
	            console.error(error);
	        } else {
	            //capture HATEOAS links
	            var links = {};
	            payment.links.forEach(function(linkObj){
	                links[linkObj.rel] = {
	                    'href': linkObj.href,
	                    'method': linkObj.method
	                };
	            })
	        
	            //if redirect url present, redirect user
	            if (links.hasOwnProperty('approval_url')){
	                res.redirect(links['approval_url'].href);
	            } else {
	                console.error('no redirect URI present');
	            }
	        }
	    });
    } catch (error) {
      // const err: IResponseError = {
      //   success: false,
      //   code: HttpStatus.BAD_REQUEST,
      //   error
      // };
      // next(err);
    }
  });
depositsRouter
  .route("/process")

  .get(async (req: Request, res: Response, next: NextFunction) => {
	  	var paymentId = req.query.paymentId;
	    var payerId = { 'payer_id': req.query.PayerID };

	    paypal.payment.execute(paymentId, payerId, function(error, payment){
	        if(error){
	            console.error(error);
	        } else {
	            if (payment.state == 'approved'){ 
				    con.connect(function(err) {
					  if (err) throw err;
					  con.query("SELECT * FROM bills where userID="+userID+"", function (err, result, fields) {
					    if (err) throw err;
					    var currentFunds=Number(result[0]['availableFunds']);
					    var resultFunds=currentFunds+Number(depositsAmount);

						  var sql = "UPDATE bills SET availableFunds = "+resultFunds+" where userID="+userID+"";
						  con.query(sql, function (err, result) {
						    if (err) throw err;
						    console.log(result.affectedRows + " record(s) updated");
						    res.redirect('http://localhost:3000/deposits');
						  });

					  });
					});
	            } else {
	                // res.send('payment not successful');
	       //          var statusCode=JSON.Parse({
				    //     status:'deposits failed',
				    // })
	            	res.redirect('http://localhost:3000/deposits');
	            }
	        }
	    });
    }
  );

export default depositsRouter;
