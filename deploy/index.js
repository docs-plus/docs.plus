var MongoClient = require('mongodb').MongoClient

//
//  config
//

var mongoPort    =  process.env.DB_PORT
var mongoHost    = process.env.DB_HOST

var dbName       = process.env.DB_NAME
var userName     = process.env.DB_USER
var userPassword =  process.env.DB_PASS

//
//  start
//

MongoClient.connect('mongodb://'+mongoHost+':'+mongoPort+'/admin',
  function(err, client) {

  if (err){
    return console.log('Error: could not connect to mongodb')
  }

  // Use the admin database for the operation
  const adminDb = client.db(dbName);
  const collection = adminDb.collection('test');

  
  // Add the new user to the admin database
  collection.insert({"a":1},
    function(err, result) {

    if (err){
      return console.log('Error: could not add new user')
    }

    // Authenticate using the newly added user
    adminDb.authenticate(userName, userPassword, function(err, result) {

      if (err){
        return console.log('Error: could authenticate with created user')
      }

      console.log('Ok')
      client.close()
    })
  })
})