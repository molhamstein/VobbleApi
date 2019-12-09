'use strict';
const path = require('path');
const ejs = require('ejs');
const configPath = process.env.NODE_ENV === undefined ?
  '../../server/config.json' :
  `../../server/config.${process.env.NODE_ENV}.json`;
const config = require(configPath);
const {
  getAudioDurationInSeconds
} = require('get-audio-duration')


var ffmpeg = require('fluent-ffmpeg');
var thumb = require('node-thumbnail').thumb;

module.exports = function (Uploadfile) {

  // return urls of file and creat thumble
  Uploadfile.afterRemote('upload', function (context, result, next) {
    let files = [];
    // folder name come from url request
    var folderName = context.req.params.container;

    let src = path.join(__dirname, '../../uploadFiles/');
    // file root save 
    var urlFileRoot = config.domain + config.restApiRoot + Uploadfile.http.path;

    // ulr save depend of folder name
    var urlFileRootSave = urlFileRoot + '/' + folderName + '/download/'

    // ulr save thumble
    var urlThumbRootSave = urlFileRoot + '/' + "thumbnail" + '/download/'

    if (process.env.NODE_ENV != undefined) {
      ffmpeg.setFfmpegPath(path.join(config.thumbUrl + config.programFFmpegName[0]));
      ffmpeg.setFfprobePath(path.join(config.thumbUrl + config.programFFmpegName[1]));
    }
    result.result.files.file.forEach((file) => {
      // cheack type of file from folder name request
      if (folderName == "videos") {
        var newWidth = 0
        var newHeight = 0
        var oldWidth = 0;
        var oldHeight = 0;
        var rotation;
        var size
        ffmpeg.ffprobe(src + "/" + folderName + "/" + file.name, function (err, metadata) {
          if (err) {} else {
            //console.log(metadata);
            metadata['streams'].forEach(function (element) {
              if (element.width) {
                oldWidth = element.width;
                oldHeight = element.height;
                rotation = element.rotation
              }
            }, this);
            if (oldWidth != 0)
              var res = oldWidth / oldHeight;
            else
              var res = 2
            //console.log("res");
            //console.log(res);
            if (rotation == -90 || rotation == 90) {
              newHeight = 400
              newWidth = newHeight * res
              size = newHeight + 'x' + parseInt(newWidth)
            } else {
              newWidth = 400
              newHeight = newWidth / res
              size = newWidth + 'x' + parseInt(newHeight)
            }
            //console.log(size)
            ffmpeg(src + "/" + folderName + "/" + file.name)
              .screenshot({
                count: 1,
                filename: file.name.substring(0, file.name.lastIndexOf('.')) + "_thumb.PNG",
                folder: src + '/thumbnail/',
                size: size
              });
          }
        });


        files.push({
          'file': urlFileRootSave + file.name,
          'thumbnail': urlThumbRootSave + file.name.substring(0, file.name.lastIndexOf('.')) + "_thumb.PNG"
        });

      }
      // cheack type of file from folder name request            
      else if (folderName == "images") {
        thumb({
          source: src + "/" + folderName + "/" + file.name, // could be a filename: dest/path/image.jpg
          destination: src + '/thumbnail/',
          concurrency: 4
        }, function (files, err, stdout, stderr) {});
        var parts = file.name.split('.');
        var extension = parts[parts.length - 1];
        files.push({
          'file': urlFileRootSave + file.name,
          'thumbnail': urlThumbRootSave + file.name.substring(0, file.name.lastIndexOf('.')) + "_thumb." + extension
        });

      } else if (folderName == "audios") {
        var fileDuration = 0;
        // From a local path...
        getAudioDurationInSeconds(src + "/" + folderName + "/" + file.name).then((duration) => {
          fileDuration = duration;

          files.push({
            'file': urlFileRootSave + file.name,
            'duration': fileDuration
          });

          context.res.json(files);
        })


      } else {
        files.push({
          'file': urlFileRootSave + file.name
        });
      }
      // this for download
      // files.push({ 'file': urlFileRootSave + file.name, 'thumble': urlThumbRootSave + file.name.substring(0, file.name.lastIndexOf('.')) + "_thumb.PNG" });

      // this for view
      // files.push({ 'file': src + folderName + "/" + file.name, 'thumble': src + "thumb/" + file.name.substring(0, file.name.lastIndexOf('.')) + "_thumb.png" });
    });
    if (folderName != "audios")
      context.res.json(files);
  });

};
