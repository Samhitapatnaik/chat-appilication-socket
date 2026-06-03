const mongoose=require("mongoose");
const userschema=new mongoose.Schema({
          name:String,
          email:String,
          password: String
})
const users=mongoose.model("user", userschema); //user is scollectionn name
module.exports=users;