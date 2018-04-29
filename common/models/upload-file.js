'use strict';
const path = require('path');
const ejs = require('ejs');
const configPath = process.env.NODE_ENV === undefined ?
    '../../server/config.json' :
    `../../server/config.${process.env.NODE_ENV}.json`;
const config = require(configPath);

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
        var urlThumbRootSave = urlFileRoot + '/' + "thumb" + '/download/'


        ffmpeg.setFfmpegPath(path.join(config.thumbUrl + config.programFFmpegName[0]));
        ffmpeg.setFfprobePath(path.join(config.thumbUrl + config.programFFmpegName[1]));

        result.result.files.file.forEach((file) => {
            // cheack type of file from folder name request
            if (folderName == "videos") {
                ffmpeg(src + "/" + folderName + "/" + file.name)
                    .screenshot({
                        count: 1,
                        filename: file.name.substring(0, file.name.lastIndexOf('.')) + "_thumb.PNG",
                        folder: src + '/thumb/',
                        size: '320x240'
                    });
            }
            // cheack type of file from folder name request            
            else if (folderName == "images") {
                thumb({
                    source: src + "/" + folderName + "/" + file.name,// could be a filename: dest/path/image.jpg
                    destination: src + '/thumb/',
                    concurrency: 4
                }, function (files, err, stdout, stderr) {
                });
            }
            // this for download
            files.push({ 'file': urlFileRootSave + file.name, 'thumble': urlThumbRootSave + file.name.substring(0, file.name.lastIndexOf('.')) + "_thumb.PNG" });

            // this for view
            // files.push({ 'file': src + folderName + "/" + file.name, 'thumble': src + "thumb/" + file.name.substring(0, file.name.lastIndexOf('.')) + "_thumb.png" });
        });
        context.res.json(files);
    });

};
