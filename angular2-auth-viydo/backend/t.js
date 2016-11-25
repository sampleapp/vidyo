var PythonShell = require('python-shell');

var appId='a09159.vidyo.io';
var devKey='74d1139a431947e0abedf3a129b45087';

var user = "XYZ";
   var options = {
     mode: 'text',
     pythonPath: '/Users/abhishek/Documents/Tools/homebrew/bin/python3',
     pythonOptions: ['-u'],
     scriptPath: '/Users/abhishek/Documents/Docker/ANG2/angular2-auth-viydo/backend/',
     args: ['--key='+devKey, '--appID='+appId, '--userName='+user, '--expiresInSecs='+'300']
   };

   console.log(options)

   PythonShell.run('generateToken.py', options, function (err, results) {
    console.log(err)
    console.log(results)
    if (err) throw err;
    console.log('results: %j', results[0]);

   });
