const readline=require("readline")
require("dotenv").config();
const { GoogleGenerativeAI } =require( "@google/generative-ai");
const genAI=new GoogleGenerativeAI(process.env.API_key);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

const express= require("express");
const  http=require("http") //http layer --1
const {Server}=require("socket.io"); //socket server --2



const cors=require("cors");
const bcrypt=require("bcrypt");
const path=require("path") //path is required because the server is sending response as the html file
const jwt=require("jsonwebtoken")

const app=express();
app.use(express.static("public"));
const server=http.createServer(app) //--4 ippudu same server meed HTTP + WebSocket (socket.io) rendu work avuthayi.
const io=new Server(server)// --3
//io connection



const userSockets = {}; //nothing but online users


io.on("connection" , (socket) =>{
 //oka user connect ayyadu
    socket.on("register" , (userId) =>{ //register class ikkada rasam ante frontend daggara rasi userid ni obtain cheyyali/chesi untamu
           userSockets[userId] = socket.id; //mapping between mongooseid -> socketid to knew whom to send message ani
         io.emit("onlineusers" , Object.keys(userSockets)) // userSockets object lo unna anni keys (userIds) ni array ga return chesthundi.
    })
    socket.on("disconnect" , () =>{
        //disconnect lo problem enti ante — socket.id telusу, kani userId teliyadu. Anduke reverse ga search chesthunnam
        const userid=Object.keys(userSockets).find(
            id =>userSockets[id]==socket.id
        );
        //userSockets lo anni keys loop cheyyali
//aa key ki value (socket.id) current disconnected socket.id ki match avuthundha chuddu
//match aithe aa userId return cheyyALI
        if(userid){
            delete userSockets[userid]
            io.emit("onlineusers" , Object.keys(userSockets))
        }
    })

    socket.on("chat message" , async (data) =>{
        console.log("data:", data);                           // data vasthundha?
   console.log("userSockets:", userSockets);             // register ayindha?
    console.log("targetsocket:", userSockets[data.ReceiverID]);

        await Message.create({
            senderID: data.senderID,
            ReceiverID: data.ReceiverID,
            text: data.text
        });
        const targetsocket=userSockets[data.ReceiverID] //stores 
        io.emit("onlineusers", Object.keys(userSockets)); // send chesthunnam frontend ki
        socket.to(targetsocket).emit("chat message" , data) //send message to reciver only
       // socket.emit("chat message" , data) 
    })
})
//schemas
const Users=require('./models/userschema')
const Message=require('./models/messageschema');
const  mongoose  = require("mongoose");
//const users = require("./models/userschema");

app.use(cors())
app.use(express.json())

//mongodb connection
mongoose.connect(process.env.MONGO_URI)
.then(()=>
    {
    console.log("database connected");
})
.catch((err) => {
 console.log("error occured" , err)
})


server.listen(process.env.PORT,() =>{
    console.log("server started")
    //console.log(__dirname)
})

app.get("/" , (req,res) =>{
    res.redirect("/frontend.html")
})

/* app.get('/chat.html',(req,res) =>{
    res.sendFile("chat.html",{root : __dirname})
})
 */
//login page
app.post("/login" , async (req,res) =>{
   const{ email, password }=req.body;
   const JWT_SECRET_TOKEN=process.env.JWT_SECRET;
      if(!email || !password)  return res.json({ success:false, msg:"Fill all fields" });
        try{
          const user=await Users.findOne({email});
          if(!user) return res.json({ success:false, msg:"User not found" });

          //matching password
          const match= await bcrypt.compare(password,user.password);
          if(!match) return res.json({ success:false, msg:"Wrong password" });
        
          const payload = { //payload anedhi data ni store chesthundhi
                    userId: user._id.toString(),
                     email: user.email,
                  name: user.name
               };

           //creating token before sending the response because if we send this after response ,when there is any error found in that ,
           // then catch will raise it will also send one response to server , server cannot take  2 responses
      const token=jwt.sign(
        payload,
        process.env.JWT_SECRET,
        {expiresIn : "1h"});
     
       res.json({success:true , name:user.name , userId:user._id.toString(),token}) 


    }
    catch(err){
        res.json({ success:false, msg:err.message });
    }
})
//middleware
const auth=(req,res,next)=>{
let bearertoken=req.headers.authorization;
//console.log("bearertoken" , bearertoken);
if(!bearertoken || !bearertoken.startsWith("bearer ")) return res.send("bearertoken is missing!YOU ARE UNAUTHORIZED")
const token=bearertoken.split(" ")[1];

try{
const decoded=jwt.verify(token , process.env.JWT_SECRET)
req.user=decoded; //data decoded
next(); //ipdu actual route run avthundhi
}

catch(err){   return res.status(401).send("Invalid token");}
}
/* app.get("/chat.html"  ,(req,res)=>{
    res.sendFile(path.join(__dirname,"public" , "chat.html"))
})  */
//middleware 


//signup
app.post("/signup" ,async (req,res) => {
    const {name,email,password}=req.body;

    if(!name || !password || !email) return res.send("Enter all fields");

    try{

    const existing=await Users.findOne({email})
    if(existing) return res.send("Email Already Registered!");

    const hashedpassword=await bcrypt.hash(password,10);

    const newuser=new Users({name , email , password:hashedpassword});
    await newuser.save();
    res.send("account created successfully")
    }
    catch(err){
        console.log("error occured" , err)
    }
})
//ai assistant

app.post("/ai-chat", async (req,res) =>{
    try{
        console.log("Request body:", req.body); // debug line
        const {message} = req.body;
        if(!message){
            return res.status(400).json({error : "message is required"});
        }
        const chat=model.startChat();
        const result = await chat.sendMessage(message); //msg ni model ki pampisthunnam
        const response=await result.response;
        const text=await response.text();

        res.json({
            reply : text,
        })
    } catch(err){
        console.log(err);
         res.status(500).json({
      error: "Failed to generate AI response",
    });
    }
});
//messages
app.get("/messages" ,auth ,  async (req,res) =>{
     const { with: otherId } = req.query;
    const myId = req.query.me; // pass from frontend
    const msgs = await Message.find({
        $or: [
            { senderID: myId, ReceiverID: otherId },
            { senderID: otherId, ReceiverID: myId }
        ]
    }).sort({ createdAt: 1 });
    res.json(msgs);
})

//users
app.get("/users",auth , async (req, res) => {
    const users = await Users.find({}, "name email").lean();  // from DB
 //   console.log("logged user:", req.user.userId);
    for(const user of users) {
        const lastMessage=await Message.findOne({
            $or :[
                {
                    senderID : req.user.userId,
                    ReceiverID: user._id.toString()
                },
                {
                    senderID: user._id.toString(),
                     ReceiverID: req.user.userId

                }
            ]
        }).sort({timestamp :-1});
        user.lastMessage = lastMessage ? lastMessage.text : "";
        
    }
    
    res.json(users)
})


app.post("/" , (req,res) => {
    console.log("server started")
})