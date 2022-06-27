import express, { json } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from "mongodb";
import joi from 'joi';
import dayjs from 'dayjs';

dotenv.config();


const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => {
	db = mongoClient.db("batePapoUol");
});

const server = express();
server.use(cors());
server.use(json());



server.post('/participants', async (req, res) => {
	const userSchema = joi.string();
	if (userSchema.validate(req.body.name).error){
		res.status(422).send("O nome não pode estar vazio");
		return;
	}
    try{
		let repetido = await db.collection('participants').findOne({ name: req.body.name });

		if(repetido){
			res.status(409).send("Este nome ja existe, escolha um nome diferente");
			return;	
		}
		let now = dayjs();
		await db.collection('participants').insertOne({name: req.body.name, lastStatus: Date.now()});
		await db.collection('messages').insertOne({
			from: req.body.name, 
			to: 'Todos',
			text: 'entra na sala...',
			type: 'status', 
			time: now.format("HH:mm:ss")});
		res.status(201);
		return
	} catch (error) {
		console.error(error);
		res.sendStatus(500);
		return;
	}

});

server.get('/participants', async (req, res) => {
	try{
		const participants = await db.collection('participants').find().toArray();
		res.send(participants)
		return;
	}catch(error){
		console.error(error);
		res.sendStatus(500);
		return;
	}
	
});

server.post('/messages', async (req, res) => {
	try{
		const participants = await db.collection('participants').find().toArray()
		const names = participants.map(e => e.name)
		const MessageSchema  = joi.object({
			from: joi.string().valid(...names).required(),
			to:   joi.string().valid(...names, "Todos").required(),
			text: joi.string().required(),
			type: joi.string().valid("message","private_message").required(),
			time: joi.string().required()
		});
		let now2 = dayjs();
		const message = {
			from: req.headers.user,
			to:   req.body.to,
			text: req.body.text,
			type: req.body.type,
			time: now2.format("HH:mm:ss")
		}
		if (MessageSchema.validate(message).error){
			res.status(422)	
			return
		}
		await db.collection('messages').insertOne(message)
		res.status(201).send()
		return
	}catch(error){
		console.error(error);
		res.sendStatus(500);
		return;
    }	
});

server.get("/messages", async(req, res) => {
	const limit = parseInt(req.query.limit);
	try{
		const messages = await db.collection('messages').find().toArray();	
		if(limit){
			
			const messagesFiltered = messages.filter(
			message => message.type === "message" || 
			message.to == req.headers.user || 
			message.from == req.headers.user  )
            const messagesLimited = messagesFiltered.slice(-limit)
			res.status(201).send(messagesLimited)
			return;
		}
		else{
			const messagesFiltered = messages.filter(
				message => message.type === "message" ||
				message.to == req.headers.user || 
				message.from == req.headers.user )
	
			res.status(201).send(messagesFiltered)
			return;	
		}
    }catch (error) {
		console.error(error);
		res.sendStatus(500);
		return;
    }
});

server.post('/status', async (req, res) => {
	try{
		const participants = await db.collection('participants').find().toArray()
		const names = participants.map(e => e.name)
		if(!names.includes(req.headers.user)){
		res.sendStatus(404)
		return;
		}else{
		await db.collection('participants').updateOne(
			{name : req.headers.user},
			{$set: { lastStatus : Date.now()}})
		}
		res.status(200).send()
		return
	}catch(error){
		console.error(error);
		res.sendStatus(500);
		return;
    }	
});

setInterval(async function () {
	try{
		const time = Date.now()
		const participants = await db.collection('participants').find().toArray()
		for(let i = 0; i< participants.length; i++){
			if(time - parseInt(participants[i].lastStatus) > 10000){
				let now4 = dayjs()
				const message = {
					from: participants[i].name,
					to:   "Todos",
					text: 'sai da sala...',
					type: 'status',
					time: now4.format("HH:mm:ss")
				}
				await db.collection('messages').insertOne(message)
				await db.collection('participants').deleteOne(participants[i])
			}
			
		}
		console.log(await db.collection('participants').find().toArray())
		console.log(await db.collection('messages').find().toArray())
	}catch(error){
		console.error(error);
		res.sendStatus(500);
		return;
    }	

}, 15000);

server.listen(5000);