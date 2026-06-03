const mongoose=require("mongoose");
const messageschema=new mongoose.Schema({
    senderID : String,
    ReceiverID : String,
    text : String,
    timestamp : {type : Date , default: Date.now}
})
const Message=mongoose.model("Message" , messageschema)
//module 
module.exports=Message;