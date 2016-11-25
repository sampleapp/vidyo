var express = require('express'),
    _  = require('lodash');
   var PythonShell = require('python-shell');

var app = module.exports = express.Router();

var rooms = [{roomName:"US-election"}, {roomName:"Indian-currency-demonitization"}];

app.post('/api/addroom', function(req, res) {
  if (!req.body.roomName) {
    return res.status(400).send("You must send the roomname");
  }
  if (_.find(rooms, {roomName: req.body.roomName})) {
   return res.status(400).send("A room already exists");
  }
  var token = Math.random();
  var e = {roomName:req.body.roomName, token:token}
  rooms.push(e);
  res.status(201).send(e);
});

app.get('/api/listroom', function(req, res) {
   res.status(201).send(rooms);
});


var appId='a09159.vidyo.io';
var devKey='74d1139a431947e0abedf3a129b45087';

app.post('/api/token', function(req, res) {

   if (!req.body.user) {
    return res.status(400).send("You must send the username");
   }
   var user = req.body.user;

   var options = {
     mode: 'text',
     pythonPath: '/Users/abhishek/Documents/Tools/homebrew/bin/python3',
     pythonOptions: ['-u'],
     scriptPath: '/Users/abhishek/Documents/Docker/ANG2/angular2-auth-viydo/backend/',
     args: ['--key='+devKey, '--appID='+appId, '--userName='+user, '--expiresInSecs='+'300']
   };

   PythonShell.run('generateToken.py', options, function (err, results) {
    var token;
    if (err) {
      return res.status(400).send("error generating token");
    }
    token = results[0];
     console.log("User token " + user + ":"+token);
    res.status(201).send({
        token: token
    });
   });
});

