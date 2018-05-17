//Main File of the Server
//Get Middleware
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

const extract = require("./routes/extract");
const vote = require("./routes/vote");
const test = require("./routes/test");

const port =process.env.PORT || 8080;

app.use(cors());

//Set Static File
app.use(express.static(path.join(__dirname,'public')));

//Body parser
app.use(bodyParser.json());

//Index Route
app.use("/extract",extract);
app.use("/vote",vote);
app.use("/test",test);

app.get("/", (req,res) => res.send("Invalid Endpoint"));

var server = app.listen(port, () => {
  console.log("Server runs on port "+port);
})
