require("dotenv").config();
const express= require("express");
const cors=require("cors");
const bcrypt=require("bcrypt");
const  http=require("http") //http layer --1
const path=require("path") //path is required because the server is sending response as the html file
const {Server}=require("socket.io"); //socket server --2
const jwt=require("jsonwebtoken")

const app=express();
app.use(express.static("public"));
const server=http.createServer(app) //--4
const io=new Server(server)// --3
//io connection
const userSockets = {};
io.on("connection" , (socket) =>{
    socket.on("register" , (userId) =>{ //register class ikkada rasam ante inkoka daggar arasi userid ni obtain cheyyali
           userSockets[userId] = socket.id; //mapping between mongooseid -> socketid
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
   const JWT_SECRET_TOKEN="thisisthesecrettoken";
      if(!email || !password)  return res.json({ success:false, msg:"Fill all fields" });
        try{
          const user=await Users.findOne({email});
          if(!user) return res.json({ success:false, msg:"User not found" });

          //matching password
          const match= await bcrypt.compare(password,user.password);
          if(!match) return res.json({ success:false, msg:"Wrong password" });
        
          const payload = { //payload anedhi data ni store chesthundhi
                   
                     email: user.email,
                  name: user.name
               };

           //creating token before sending the response because if we send this after response ,when there is any error found in that then catch will raise it will also send one response to server , server cannot take  2 responses
      const token=jwt.sign(payload,process.env.JWT_SECRET,{expiresIn : "1h"});
     // console.log("token" , token)// to check the token first
     // const decodedversion=jwt.verify(token,JWT_SECRET_TOKEN); //for testing uss this in middleware
     // console.log("DECODED VERSION " , decodedversion) //here you will get the details of the payload

       res.json({success:true , name:user.name , userId:user._id.toString(),token}) 
      // console.log("userid" ,userid)

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
req.user=decoded;
next();
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
    const users = await Users.find({}, "name email")  // from DB
    res.json(users)
})
app.post("/" , (req,res) => {
    console.log("server started")
})