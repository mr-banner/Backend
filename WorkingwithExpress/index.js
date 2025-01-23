import express from 'express'
const app = express();
const port = 3000;
app.use(express.json());
const users = [];
let index = 1;

// adding name
app.post('/addUser',(req,res)=>{
    const {name,age} = req.body;
    const user = {id: index++,name,age};
    users.push(user);
    res.status(201).send(user);
})

// getting all users
app.get('/getUsers',(req,res)=>{
    res.status(200).send(users);
})

// get specific user
app.get('/getUsers/:id',(req,res)=>{
    const id = parseInt(req.params.id);
    const user = users.find(user => user.id === id)
    if(!user){
        res.status(404).send('User not found');
    }
    res.status(200).send(user);
})

// update user
app.put('/updateUser/:id',(req,res)=>{
    const id = parseInt(req.params.id);
    const user = users.find(user => user.id === id);
    if(!user){
        res.status(404).send('User not found');
    }
    const {name,age} = req.body;
    user.name = name;
    user.age = age;
    res.status(201).send(user);
})

// delete user
app.delete('/deleteUser/:id',(req,res)=>{
    const id = parseInt(req.params.id);
    const userIndex = users.findIndex(user => user.id === id);
    if(userIndex === -1){
        res.status(404).send('User not found');
    }
    users.splice(userIndex,1);
    res.status(200).send('User deleted');
})

app.listen(port,()=>{
    console.log(`server is running on port ${port}.....`);
    
})