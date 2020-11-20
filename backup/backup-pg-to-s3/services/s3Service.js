AWS = require('aws-sdk');
const fs = require('fs');

module.exports = class s3Service {
    constructor(endPoint ,accessKeyId, accessKeySecret, bucket ) {
        this.endPoint = endPoint ;
        this.accessKeyId = accessKeyId ;
        this.accessKeySecret = accessKeySecret ;
        this.bucket = bucket ;
        this.s3Client = null 
        this.connect()
    }
 
    connect(){
        this.s3Client  = new AWS.S3({
            accessKeyId: this.accessKeyId,
            secretAccessKey: this.accessKeySecret,
            endpoint: this.endPoint, 
            s3ForcePathStyle: true,
            signatureVersion: 'v4'
        });
 
    }
    uploadBackupFile() {
        const fileContent = fs.readFileSync( "./backup.tar.gz");

        let params_upload = {
            
            Bucket: this.bucket,
            Key: "backup.tgz", // File name you want to save as in S3
            Body: fileContent
        };
        this.s3Client.upload(params_upload, function(err, data) {
            if (err)
                console.log(err, err.stack,"error")
            else   
                console.log(data);

            
            
        });
    }
 }