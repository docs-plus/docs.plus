var path = require('path');
const util = require('util');
const execFile = util.promisify(require('child_process').execFile);
const BACKUP_SCRIPT = './scripts/backupPg.sh'
var BACKUP_SCRIPT_PTRH = path.resolve(__dirname, BACKUP_SCRIPT);
module.exports = class pgService {
    constructor(dbConfig) {
        this.dbConfig = dbConfig;
        //this.backupCommand = `${BACKUP_SCRIPT} --PGHOST=${this.dbConfig.PGHOST} --PGHOST=${this.dbConfig.DB_PASS}@${this.dbConfig.DB_HOST}:${this.dbConfig.DB_PORT}/${this.dbConfig.DB_NAME}`;

    }
 
    async runPgBackup(){
        return new Promise( async (resolve,rejects)=>{
            const { stdout, stderr } = await execFile(BACKUP_SCRIPT_PTRH,this.dbConfig);
            console.log('stdout:', stdout);
            console.log('stderr:', stderr);
            resolve()
        })
        
    }
 }