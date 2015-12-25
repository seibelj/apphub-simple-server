var watchr = require('watchr');
var md5File = require('md5-file')
var moment = require('moment');
var express = require('express');
var path = require('path');
var app = express();

var GET_BUILD_TYPE = 'GET-BUILD';
var NO_BUILD_TYPE = 'NO-BUILD';

// Set to false if you want to manually set new builds using the
// data structure below.
//
// Set to true to watch the builds/ folder for new builds.
// Any new file created or moved into it becomes the latest build.
// Renaming an existing file alos causes it to become a new build.
// After the first successful download, there is no longer a new build.
var watchBuilds = true;

// If you are not watching for new builds,
// change to true if there is a newer build available for this version
// of the app.
var buildIsAvailable = false;

// If you are not watching for new builds, fill these out manually.
// When watching, this gets created automatically.
var buildResultData = {
  type: GET_BUILD_TYPE,
  project_uid: null,

  // A consistent id for the build, such as the key or hash.
  // The AppHub client uses this id to determine whether the
  // most current build has changed.
  uid: '',

  // Name for the build.
  name: 'Build Name',

  // Description for the build.
  description: '',

  // URL of the zipped build. Does not necessarily have to be
  // an s3 url.
  s3_url: '',

  // Epoch time in milliseconds since 1970 when the build was
  // created. This is only used for metadata, not to determine
  // whether the build should be used.
  created: 0,

  // Native app versions for which the build is compatible.
  // The official AppHub client only uses the values of the object, not the keys.
  app_versions: {
    '1.0': '1.0',
  },
};

app.get('/projects/:projectUid/build', function (req, res) {
  var projectUid = req.params.projectUid;
  var appVersion = req.query.app_version

  var resultData;
  if (buildIsAvailable) {
    resultData = buildResultData;
    resultData.project_uid = projectUid;
  } else {
    resultData = {
      type: NO_BUILD_TYPE,
    };
  }

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    status: 'success',
    data: resultData,
  }));

});

app.get('/latest_build', function (req, res) {
  var fileName = req.query.file;
  var options = {
    root: __dirname + '/builds/',
    dotfiles: 'deny',
    headers: {
        'x-timestamp': Date.now(),
        'x-sent': true
    }
  };
  res.sendFile(fileName, options, function (err) {
    if (err) {
      console.log(err);
      res.status(err.status).end();
    }
    else {
      buildIsAvailable = false;
      console.log('Sent New Build to Client:', fileName);
    }
  });
});

var server = app.listen(3000, function () {
  var port = server.address().port;

  console.log('Example app listening at port', port);
});


var buildCount = 0;
function getBuildResultData(filePath) {
  buildCount++;
  return {
    type: GET_BUILD_TYPE,
    project_uid: null,

    uid: md5File(filePath),
    name: 'Build #' + buildCount,
    description: 'A new build created by watching the builds folder',
    s3_url: 'http://localhost:3000/latest_build?file='+encodeURIComponent(path.basename(filePath)),
    created: moment().unix(),
    app_versions: {
      '1.0': '1.0',
    },
  };
}

var buildDir = __dirname + '/builds';
if (watchBuilds) {
  watchr.watch({
    paths: [buildDir],
    listeners: {
      change: function(changeType,filePath,fileCurrentStat,filePreviousStat){
        if (changeType === 'create') {
          console.log('new build created: ' + filePath)
          buildIsAvailable = true;
          buildResultData = getBuildResultData(filePath);
          console.log('new result data', buildResultData);
        }
      }
    },
    next: function(err,watchers){
      if (err) {
        return console.log("Watching for new builds failed with error", err);
      } else {
        console.log('Watching for new builds in ' + buildDir);
      }
    }
  });
}
