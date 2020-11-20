const pgService = require("../services/pgService")
const s3Service = require("../services/s3Service")

module.exports = class mainController {
    constructor() {
 
    }
 
    runBackup() {
        var dbConfig = [
            `79.68.68.68`,//${process.env.PGHOST}
            `${process.env.PGPORT}`,
            `${process.env.PGDATABASE}`,
            `${process.env.PGUSER}`,
            `${process.env.PGPASSWORD}`,
        ]
        var pgConnection = new pgService(dbConfig)
        return pgConnection.runPgBackup()
    }

    runUpload(){
        var s3Connection = new s3Service(
            process.env.ULTIMA_BUCKET_S3_SERVER ,
            process.env.ULTIMA_BUCKET_ACCESS_KEY_ID ,
            process.env.ULTIMA_BUCKET_ACCESS_KEY_SECRET ,
            process.env.EP_MEDIA_BUCKET_NAME ,
        )
        s3Connection.uploadBackupFile()
    }
 }