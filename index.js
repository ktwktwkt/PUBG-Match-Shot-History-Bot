const { Client, GatewayIntentBits, EmbedBuilder, User  } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds
                                    , GatewayIntentBits.GuildMessages
                                    , GatewayIntentBits.MessageContent
                                    , GatewayIntentBits.GuildMembers
                                    , GatewayIntentBits.GuildScheduledEvents
                                    , GatewayIntentBits.DirectMessages
                                ],partials:["CHANNEL"] });
const { token, channelId, pubgtoken } = require('./config.json');
const https = require('https');
const fs = require('fs');


const USER = {
    userlist : {},
    getUser : function(){
        return this.userlist;
    },
    setUser : function(list){
        this.userlist = list;
    },
    saveUser : function(){        
        fs.writeFileSync("./userlist.json", JSON.stringify(this.userlist));
    },
    loadUser : function(){
        this.userlist = JSON.parse(fs.existsSync("./userlist.json")?fs.readFileSync("./userlist.json"):'{}');
        return this.userlist;
    },
    getUserByID : function(userid){
        return this.userlist[userid];
    },
    addUser : function(userid,id,tag,playerid){
        this.userlist = this.loadUser();
        // console.log(userid,id)    
        this.userlist[userid] = {
            "id":id,
            "tag":tag,
            "playerid":playerid,
            "lastMatch":"",
            "channelid":"",
            "trace":false
        };
        this.saveUser();
    },
    setLastMatch : function (userid, matchId){
        this.userlist[userid].lastMatch = matchId;
        this.saveUser();
    },
    getLastMatch : function (userid){
        return this.userlist[userid].lastMatch;
    },
    getUserID : function(userid){
        return this.userlist[userid].id;
    },
    getPlayerID : function(userid){
        return this.userlist[userid].playerid;
    },
}


logger("USERLIST LOAD")
USER.loadUser();

const Pubgapi = require('pubg-api');
const { Http2ServerRequest } = require('http2');
const { resolve } = require('path');
const { rejects } = require('assert');
const { trace } = require('console');
 
const apiInstance = new Pubgapi(pubgtoken);

let traceInterval = {};




client.once('ready', (e) => {
	logger(`@${e.user.username}#${e.user.discriminator} READY`);


    //set traceinterval
    list = USER.getUser();
    for(let x in list){
        console.log(list[x])
        if(list[x].trace==true){
            console.log("###"+ list[x].channelid)
            setTraceInterval(x, list[x].channelid);
        }
    }
});
client.on('interactionCreate', async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const { commandName } = interaction;

	if (commandName === 'ping') {
		await interaction.reply('Pong!');
	} else if (commandName === 'server') {
		await interaction.reply(`Server name: ${interaction.guild.name}\nTotal members: ${interaction.guild.memberCount}`);
	} else if (commandName === 'user') {
		await interaction.reply(`Your tag: ${interaction.user.tag}\nYour id: ${interaction.user.id}`);
	}
});

client.login(token);

client.on('messageCreate', async messages => {
    // console.log(messages);
    let channelId = messages.channelId;
    if(messages.guildId == null) return;
    let userid = messages.author.id;
    let username = messages.author.username;
    
    if(messages.content[0]=="!"){
        let matches = null;
        matches = messages.content.match(/^!alarm (^[1-9]{1}$|[0-9]{0,})/);
        if(matches && matches[1] > 0){
            logger("set Alarm " + matches[1] + " seconds");
            setTimeout(()=>{
                client.channels.fetch(channelId).then(channel => {
                    logger("end Alarm " + matches[1] + " seconds");
                    channel.send("Alarm for "+matches[1]+" seconds.");
                });
            },matches[1]*1000)
            return;
        }

        matches = messages.content.match(/^!dmalarm (^[1-9]{1}$|[0-9]{0,})/);
        if(matches && matches[1] > 0){
            logger("set Alarm " + matches[1] + " seconds");
            setTimeout(()=>{
                client.users.fetch(userid).then(dm => {
                    logger("end Alarm " + matches[1] + " seconds");
                    dm.send("Alarm for "+matches[1]+" seconds.");                    
                });
            },matches[1]*1000)
            return;
        }

        matches = messages.content.match(/^!last[ ]{0,1}([0-3]{0,1}[0-9]{0,1})|^!lastmatch$/);
        // if(matches && !matches[1]){
        if(matches){
            if(typeof(USER.getUserByID(userid))=="undefined"){                
                client.channels.fetch(channelId).then(channel => {
                    channel.send(`Please Set Id first. [ex)!set {PUBGID}]`);
                });
            }
            logger(matches[1])
            //get player's match
            getMatch(userid, matches[1]*1).then(getMatchData).then(messageList=>{
                sendMessageList(channelId, messageList); 
            }).catch(e=>logger(e,3));
            return;
        }
        

        matches = messages.content.match(/^!hack[ ]{0,1}([0-9]{0,1})|^!hack$/);
        // if(matches && !matches[1]){
        if(matches){
            if(typeof(USER.getUserByID(userid))=="undefined"){       
                sendMessage(channelId, `Please Set Id first. [ex)!set {PUBGID}]`)
            }
            //get player's match
            var m = null;
            getMatch(userid, matches[1]*1).then(getHackData).then(messageList=>{
                sendMessageList(channelId, messageList); 
            });
            return;
        }
        
        matches = messages.content.match(/^!trace$/);
        if(matches){            
            let id = USER.getUserID(userid);
            let istrace = USER.getUserByID(userid).trace;
            sendMessage(channelId, "[" + id + "] "+(istrace?"ON TRACE":"TRACE STOPPED"));
            return;
        }

        matches = messages.content.match(/^!trace start/);
        if(matches){            
            checkTraceInterval(userid, channelId);
            return;
        }

        matches = messages.content.match(/^!trace stop/);
        if(matches){
            clearTraceInterval(userid, channelId);
            return;
        }


        matches = messages.content.match(/^!help/);
        console.log(matches);
        if(matches){
            // SET | TRACE START/STOP | LAST | HACK |
            let message = "";
            message += "`!set [username] \nex)\'!set XXXX\' set username to XXXX.`\n";
            message += "`!last [beforematch] \nex)\'!last\' get match info. \'!last 1\' get match info before 1 match.`\n";
            message += "`!hack [beforematch] \nex)\'!hack\' get match KilledBy info.`\n";
            message += "`!trace [start/stop] \nex)\'!trace start\' Start trace user match info.`\n";
            
            sendMessage(channelId,message)
            return; 
        }

        matches = messages.content.match(/^!info/);
        console.log(matches);
        if(matches){
            console.log(matches[1])
            
            // sendMessage(channelId, USER.getUserByID(userid))                
            
            // sendMessage(channelId,{ embeds: [embed] })
            return; 
        }

        matches = messages.content.match(/^!info (.*){0,}/);
        console.log(matches);
        if(matches && matches[1]){
            console.log(matches[1])
            
            apiInstance
                .searchPlayers({"playerNames":matches[1]},"kakao")
                .then(player => {
                    // success
                    console.log(player)
                    apiInstance
                    .loadPlayerById(player.data[0].id,"kakao")
                    .then(player => {
                        // success
                        console.log(player)
                    }, err => {
                        // handle error
                        console.log(err)
                    });
                return;

                }, err => {
                    // handle error
                    console.log(err)
                });
            return;
        }


        matches = messages.content.match(/^!set (.*)/);
        // console.log(matches);
        if(matches && matches[1]){
            // add and set ID


            apiInstance
                .searchPlayers({"playerNames":matches[1]},"kakao")
                .then(player => {
                    // success
                    // console.log(player)
                    USER.addUser(userid,matches[1],messages.author.tag,player.data[0].id);

                    sendMessage(channelId, `Set [${messages.author.tag}]'s ID to [${matches[1]}(${player.data[0].id})]`)            
                }, err => {
                    // handle error
                    console.log(err)
                    sendMessage(channelId, `Set [${messages.author.tag}]'s ID Failed. ${err.errors[0].detail}`) 
                });


            return;
        }
    }
})

function clearTraceInterval(userid, channelId) {
    if (typeof (traceInterval[userid]) == "undefined" || traceInterval[userid] == null) {
        sendMessage(channelId, "TRACE is Already Stop.");
    } else {
        sendMessage(channelId, "Stop TRACE");
        clearInterval(traceInterval[userid]);
        traceInterval[userid] = null;

        
        USER.getUserByID(userid).trace=false;
        USER.getUserByID(userid).channelId="";
        USER.saveUser();
    }
}

function checkTraceInterval(userid, channelId) {
    //interval is on => check channelId => changed > clear and restart
    console.log(typeof(USER.getUserByID(userid)),USER.getUserByID(userid));
    if(typeof(USER.getUserByID(userid))=="undefined"){                
        client.channels.fetch(channelId).then(channel => {
            channel.send(`Please Set Id first. [ex)!set {PUBGID}]`);
        });
        return;
    }

    if (typeof (traceInterval[userid]) == "undefined" || traceInterval[userid] == null) {
        let id = USER.getUserID(userid);
        logger("[" + id + "] TRACE START");

        setTraceInterval(userid, channelId);
    } else {
        if(USER.getUserByID(userid).channelId!=channelId){
            clearTraceInterval(userid, channelId);            
            setTraceInterval(userid, channelId);
        }else{
            sendMessage(channelId, "TRACE is Already Set.");
        }
    }
}

function setTraceInterval(userid, channelId) {
    let id = USER.getUserID(userid);
    USER.getUserByID(userid).trace=true;
    USER.getUserByID(userid).channelid=channelId;
    console.log(USER.getUserByID(userid).channelid, channelId)
    USER.saveUser();    
    sendMessage(channelId, "[" + id + "] Start TRACE");

    getMatch(userid).then(checkLastMatch).then(getMatchData).then(messageList => {
        sendMessageList(channelId, messageList);
    }).catch(e => logger(e, 1));

    traceInterval[userid] = setInterval(function () {
        getMatch(userid).then(checkLastMatch).then(getMatchData).then(messageList => {
            sendMessageList(channelId, messageList);
        }).catch(e => logger(e, 1));
    }, 30000);
}

/**
  * @param {channelId} channelId
  * @param {String} message
  */
function sendMessage(channelId, message) {
    client.channels.fetch(channelId).then(channel => {
        channel.send(message).catch(e=>{
            console.log(e);
            console.log(e.toString() + " " + e.requestBody.json.content.length);
            channel.send(e.toString())
        });
    })
}


/**
  * @param {channelId} channelId
  * @param {String} message
  */
 function sendMessageList(channelId, message) {
    client.channels.fetch(channelId).then(channel => {
        message.forEach(m=>{
            channel.send(m).catch(e=>{
                console.log(e);
                console.log(e.toString() + " " + e.requestBody.json.content.length);
                channel.send(e.toString())
            });
        })
    })
}

// function sendMessageSeq(channelId, message) {
//     console.log(message.length)
//     if(message.length>1500){
        
//     }
//     client.channels.fetch(channelId).then(channel => {
//         let t = performance.now()
//         for(let i = 0 ; i < 20 ; i++){
//             channel.send("#"+i+" "+message+" "+(performance.now()-t));
//         }
//     });
// }




//GET TEAMMATES
function getMates(idorname){

    return [];
}
function getMatesById(idorname){

    return [];
}
function getMatesByName(idorname){

    return [];
}

//common modules
//shot data to history
function getHistory(shot){
    let history = [];
    let shotcounter = 0;
    /*  
        *  {type:"",value:"",list:[]}
        *  type = missed / hit(H=#) / groggy(@ => //kill@@//) / seperator
        *                                        */

    let LogPlayerAttack = shot.filter(d=>d._T=="LogPlayerAttack");
    let LogPlayerTakeDamage = shot.filter(d=>["LogPlayerTakeDamage","LogVehicleDamage"].includes(d._T));
    let LogPlayerMakeGroggy = shot.filter(d=>d._T=="LogPlayerMakeGroggy");
    let firstshot = null;
    let lastshot = null;

    for(let i = 0 ; i < LogPlayerAttack.length ; i++){
        let fired = LogPlayerAttack[i];
        let damage = null
        let damagelog = LogPlayerTakeDamage.filter(d=>d.attackId==fired.attackId);
        // logger("###"+damagelog.length)
        if(damagelog.length<2){
            damage = damagelog[0];
        }else{
            damage = damagelog.reduce((acc,cur)=>{
                // console.log(acc)
                acc.damage+=cur.damage;
                return acc;
            });
        }

        if(fired["fireWeaponStackCount"] < shotcounter || (history.length > 0 && (new Date(fired._D)-new Date(history[history.length-1].list[0]._D)) > 60 * 1000 )){
            lastshot = history[history.length-1].list.at(-1);
            history[history.length] = {type:"seperator",value:history[history.length-1].list[0].weapon.itemId.split("_")[2],list:[],ftime:(new Date(lastshot._D)-new Date(firstshot._D))};
            firstshot = null;
        }                                          
        shotcounter = fired["fireWeaponStackCount"];

        if(firstshot == null){
            firstshot = fired;
        }

        if(typeof(damage)!="undefined"){
            let groggy = LogPlayerMakeGroggy.filter(d=>d.attackId==fired.attackId)[0];

            let list = [];                                           
            list.push(fired);
            list.push(damage);

            if(typeof(groggy)!="undefined"){
                list.push(groggy);
            }
            history[history.length] = {type:"hit",value:damage.damage.toFixed(1),list:list};

        }else if((history.length > 0 && ["hit","seperator"].includes(history[history.length-1].type))||history.length == 0){                                                
            history[history.length] = {type:"missed",value:0,list:[fired]};
        }else{
            history[history.length-1]["list"].push(fired);
        }

    }
    if(LogPlayerAttack.length > 0){
        lastshot = history[history.length-1].list.at(-1);
        history[history.length] = {type:"seperator",value:history[history.length-1].list[0].weapon.itemId.split("_")[2],list:[],ftime:(new Date(lastshot._D)-new Date(firstshot._D))};
    }

    console.log(history);
    return history;
}

//history to text
function getShotText(history){
    let message = "";
    let templine = "";
    let hitcount = 0;
    let shotcount = 0;
    for(let i = 0 ; i < history.length ; i++){
        if(history[i].type == "missed"){
            shotcount += history[i].list.length;
            if(history[i].list.length == 0) continue;

            if(i != 0 && templine.length != 0)
                templine += " - ";
            templine += "*"+history[i].list.length+"M"+"*"
        }else if(history[i].type == "hit"){    
            shotcount++;                                        
            hitcount++;    
            if(i != 0 && templine.length != 0)
                templine += " - ";

            let dm = "";             
            console.log(history[i].list[1]._T, history[i].list[1].distance,getDistance(history[i].list[1]))   
            if(getDistance(history[i].list[1])<=5000){
                dm = "C"+dm;
            }else if(getDistance(history[i].list[1])>5000 && getDistance(history[i].list[1])<=15000){
                dm = "M"+dm;
            }else if(getDistance(history[i].list[1])>15000 && getDistance(history[i].list[1])<=25000){
                dm = "L"+dm;
            }else if(getDistance(history[i].list[1])>25000){
                dm = "LL"+dm;
            }


            if(history[i].list[1].damageReason == "HeadShot")
                dm += "H";//"#";

            dm += history[i].value
            if(history[i].list.length > 2)
            dm += "G";//"@";  
            
            if(history[i].list[1]._T == "LogVehicleDamage"){
                dm += "V";
            }else{
                dm = "<"+dm+">"
            }
            templine += dm
                                          
        }else if(history[i].type == "kill"){
            console.log("##KILL##")
            templine += " - <KILL>";
        }else if(history[i].type == "seperator"){
            templine = `[${history[i].value}/${(history[i].ftime/1000).toFixed(1)}s][${hitcount}/${shotcount}(${((hitcount/shotcount)*100).toFixed(1)}%)]\n  ` + templine;
            if(i != history.length-1)
                templine += "\n";
            hitcount = 0;
            shotcount = 0;
            message += templine;
            console.log(templine)
            templine = "";
        }
    }

    if(history.length > 0)
    message = ">>> ```md\n" + message + "```"

    console.log(message);
    return message;
}









function logger(message,level=0){
    // logger level
    // 0 DEBUG
    // 1 INFO
    // 2 WARN
    // 3 ERROR
    // 4 FATAL
    let lstr = ["DEBUG","INFO","WARN","ERROR","FATAL"];    
    let str = `[${time()} #${lstr[level]}#] ${message}`;


    if(level == 0){
        console.log(str);
    }else if(level == 1){
        console.info(str);
    }else if(level == 2){
        console.warn(str);
    }else if(level == 3){
        console.error(str);
    }else if(level == 4){
        console.error(str);
    }
}

function time(format="YYYY-MM-DD hh:mm:ss.S",date=new Date()){
    let str = "";
    // console.time(1)
    str = format.replaceAll(/YYYY/g,date.getFullYear())
                .replaceAll(/YYY/g,date.getFullYear().toString().substring(1,4))
                .replaceAll(/YY/g,date.getFullYear().toString().substring(2,4))
                .replaceAll(/Y/g,date.getFullYear().toString().substring(3,4))
                .replaceAll(/MM/g,(date.getMonth()+1<10?"0":"")+(date.getMonth()+1))
                .replaceAll(/M/g,date.getMonth()+1)
                .replaceAll(/DD/g,(date.getDate()<10?"0":"")+(date.getDate()))
                .replaceAll(/D/g,date.getDate())
                .replaceAll(/hh/g,(date.getHours()<10?"0":"")+(date.getHours()))
                .replaceAll(/h/g,date.getHours())
                .replaceAll(/mm/g,(date.getMinutes()<10?"0":"")+(date.getMinutes()))
                .replaceAll(/m/g,date.getMinutes())
                .replaceAll(/ss/g,(date.getSeconds()<10?"0":"")+(date.getSeconds()))
                .replaceAll(/si/g,((date.getMilliseconds()/10).toFixed(0)<10?"0":"")+(date.getMilliseconds()/10).toFixed(0))
                .replaceAll(/s/g,date.getSeconds())
                .replaceAll(/S/g,date.getMilliseconds())
                // console.timeEnd(1)
    return str;
}

function getMatch(userid, matchnum=0){
    return new Promise((resolve, reject) => {
        apiInstance
            .loadPlayerById(USER.getPlayerID(userid),"kakao")
            .then(player => {
                // success
                //player.data.relationships.matches.data[0+(matchnum)].id
                let matchid = player.data.relationships.matches.data[0+(matchnum)].id;
                logger(matchid);

                return resolve([userid, matchid]);
            }, err => {
                // handle error
                console.log(err)
            });
    });
}

function getMatchData([userid, matchid]){
    return new Promise((resolve, reject) => {
        // console.log(player)
        logger(userid+"/"+matchid);
        //get last Match
        apiInstance
            .loadMatchById(matchid)
            .then((match)=> {
                console.log("######################################");
                apiInstance.findTelemetryURLs(match)()
                    .then((urls) => {
                        console.log(urls[0]);
                        return apiInstance.loadTelemetry(urls[0]);
                    })
                    .then((telemetry) => {                                    
                        // console.log(telemetry);                                    
                        // get Statics of player data From match
                        // get Teammates Id
                        // get Teammates Statics
                        let participant = match.included.filter(data => data.type=="participant");
                        let roster = match.included.filter(data => data.type=="roster");

                        let pid = participant.filter(data => data.attributes.stats.playerId == USER.getPlayerID(userid))[0].id;                                    
                        let matesid = roster.filter(data => data.relationships.participants.data.some(e=>e.id == pid))[0].relationships.participants.data.map(e=>e.id);

                        let mates = participant.filter(data => matesid.includes(data.id));
                        console.log(mates);

                        let messageList = [];
                        let message = "";
                        message += `**#${mates[0].attributes.stats.winPlace}[${match.raw.data.attributes.gameMode}-${match.raw.data.attributes.mapName.split("_")[0]}] ${time("YYYY-MM-DD hh:mm:ss",new Date(new Date(match.raw.data.attributes.createdAt).getTime()-new Date(0*9*60*60*1000).getTime()))} (${(match.raw.data.attributes.duration/60).toFixed(1)}Min)\n**`;

                        logger(match.raw.data.attributes.gameMode)
                        logger(["solo","duo","squad"].includes(match.raw.data.attributes.gameMode))

                        if(!["solo","duo","squad"].includes(match.raw.data.attributes.gameMode)){
                            message += "Shot log not support for ArcadeMode."
                            messageList.push(message);
                            return resolve(messageList);   
                        }
                        messageList.push(message);



                        // get Shot statics of player data From telemetry
                        mates.forEach(data => {
                            let message = "";
                            message += `\`${data.attributes.stats.name} - K/A ${data.attributes.stats.kills}(${data.attributes.stats.headshotKills})/${data.attributes.stats.assists} DEALT ${data.attributes.stats.damageDealt.toFixed(1)}\`\n`;

                            let shot = telemetry.filter(d=>d["attacker"]&&d["attacker"]["accountId"]==data.attributes.stats.playerId&&d["attackId"]>1&&d["_T"]!="LogArmorDestroy");
                            
                            message += getShotText(getHistory(shot));
                            messageList.push(message);
                        })
                        //filter Teammates Shot Statics
                            
                        message += "\n"
                        // sendMessageList(channelId, messageList); 
                        return resolve(messageList);     

                    })
                    .catch((err) => {
                        console.error(err)
                    });
                //////////////
            }, err => {
                // handle error
                console.log(err)
            });
    });
}

function checkLastMatch([userid, matchid]){
    return new Promise((resolve, reject) => {
        // userlist = loadUser();        
        if(USER.getLastMatch(userid) != matchid){
            USER.setLastMatch(userid, matchid);
            return resolve([userid, matchid]);
        }else{
            return reject("This match["+userid+" / "+matchid+"] is already SENT.")
        }

    });
}

function getHackData([userid, matchid]){
    return new Promise((resolve, reject) => {
        // console.log(player)
        logger(matchid);
        //get last Match
        apiInstance
            .loadMatchById(matchid)
            .then((match)=> {
                console.log("######################################");
                apiInstance.findTelemetryURLs(match)()
                    .then((urls) => {
                        // console.log(urls[0]);
                        return apiInstance.loadTelemetry(urls[0]);
                    })
                    .then((telemetry) => {                                    
                        // console.log(telemetry);                                    
                        // get Statics of player data From match
                        // get Teammates Id
                        // get Teammates Statics
                        // logger("getData elapsed : "+(performance.now() - logstart)+"ms")

                        let participant = match.included.filter(data => data.type=="participant");
                        let roster = match.included.filter(data => data.type=="roster");

                        let pid = participant.filter(data => data.attributes.stats.playerId == USER.getPlayerID(userid))[0].id;                                    
                        let matesid = roster.filter(data => data.relationships.participants.data.some(e=>e.id == pid))[0].relationships.participants.data.map(e=>e.id);

                        let mates = participant.filter(data => matesid.includes(data.id));
                        console.log(mates);

                        // logger("getData elapsed : "+(performance.now() - logstart)+"ms")
                        let messageList = [];
                        let message = "";
                        message += `\`\`#${mates[0].attributes.stats.winPlace}[${match.raw.data.attributes.gameMode}-${match.raw.data.attributes.mapName.split("_")[0]}] ${time("YYYY-MM-DD hh:mm:ss",new Date(new Date(match.raw.data.attributes.createdAt).getTime()-new Date(0*9*60*60*1000).getTime()))} (${(match.raw.data.attributes.duration/60).toFixed(1)}Min)\`\``;

                        logger(match.raw.data.attributes.gameMode)
                        logger(["solo","duo","squad"].includes(match.raw.data.attributes.gameMode))
                        if(!["solo","duo","squad"].includes(match.raw.data.attributes.gameMode)){
                            message += "Shot log not support for ArcadeMode."

                            // sendMessage(channelId, message);   
                            messageList.push(message);
                            return resolve(messageList);
                        }
                        messageList.push(message);
                        // get Shot statics of player data From telemetry
                        mates.forEach(data => {
                            let message = "";
                            message += `\`${data.attributes.stats.name} - K/A ${data.attributes.stats.kills}(${data.attributes.stats.headshotKills})/${data.attributes.stats.assists} DEALT ${data.attributes.stats.damageDealt.toFixed(1)}\`\n`;

                            let killedBy = telemetry.filter(d=>d["victim"]&&d["victim"]["accountId"]==data.attributes.stats.playerId&&d["attackId"]>1&&d["_T"]=="LogPlayerMakeGroggy");
                            
                            killedBy.forEach(data =>{
                                message += `\`    ${data["attacker"]["name"].replace("_","__")} - ${(data.distance/100).toFixed(2)}M    \`\n`;
                                let shot = telemetry.filter(d=>d["attacker"]&&d["attacker"]["name"]==data["attacker"]["name"]&&d["attackId"]>1&&d["_T"]!="LogArmorDestroy"&&btw(d["_D"],data["_D"]));    
                                logger("hack")
                                message += getShotText(getHistory(shot))+"";
                            })
                            messageList.push(message);
                        })

                        message += "\n"

                        return resolve(messageList);            
                    })
                    .catch((err) => {
                        console.error(err)
                    });
                //////////////
            }, err => {
                // handle error
                console.log(err)
            });
    });
}
function getDistance(history){
    if(history._T=="LogVehicleDamage"){
        return history.distance;
    }else if(history._T=="LogPlayerTakeDamage"){
        return calDistance(history.attacker,history.victim)
    }
}
function calDistance(attacker, victim){
    // console.log("####",attacker.location.x,victim.location.x)
    return Math.sqrt(Math.pow(attacker.location.x-victim.location.x,2) + Math.pow(attacker.location.y-victim.location.y,2))
}

function btw(otime, dtime, start=1, end=0.5){
    let stime = new Date(new Date(dtime).getTime()-new Date(start*60*1000).getTime());
    let etime = new Date(new Date(dtime).getTime()+new Date(end*60*1000).getTime());
    if(new Date(otime) >= stime && new Date(otime) <= etime){
        return true;
    }
    return false;
}