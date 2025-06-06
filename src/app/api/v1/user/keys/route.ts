import {NextRequest, NextResponse} from "next/server";
import Database from "@/lib/db";
export async function GET(req:NextRequest){
    //Get the authorization header
    const authHeader = req.headers.get("Authorization");
    const cacheId = req.nextUrl.searchParams.get("cache");
    if(!cacheId){
        return NextResponse.json({error: "Cache ID is required"}, {status: 400});
    }
    if(!authHeader){
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    if(!authHeader.startsWith("Bearer ")){
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    const apiKey = authHeader.split(" ")[1];
    if(!apiKey){
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const db = new Database();
    let status = 200;
    let data = {};
    try{

        if(cacheId === "all"){
            const excludedCaches = req.nextUrl.searchParams.get("excluded");
            if(!excludedCaches){
                throw new Error("Excluded caches not found.");
            }
            const caches = await db.getKeysForUser(apiKey, excludedCaches);
            if(!caches){
                status = 404;
                data = {error: "No caches found"};
            } else {
                data = caches;
            }
        }
        else{
            const keys = await db.getKeysForCache(cacheId, apiKey);
            if(!keys){
                status = 404;
                data = {error: "Cache not found"};
            } else {
                data = keys;
            }
        }
    }
    catch(err){
        status = 400;
        data = {error: "Bad Request"};
    }

    await db.close();
    return NextResponse.json(data, {status: status});
}

export async function POST(request:NextRequest){
    //Verify the request
    const authHeader = request.headers.get("Authorization");
    if(!authHeader){
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    if(!authHeader.startsWith("Bearer ")){
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const apiKey = authHeader.split(" ")[1];

    if(!apiKey){
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    //Get the body
    let body;
    try{
        body = await request.json();
    }
    catch(err){
        console.log(err);
        return NextResponse.json({error: "Bad Request"}, {status: 400});
    }
    console.log(body.description)
    //Check if the body is valid
    if(!body.name){
        return NextResponse.json({error: "Name is required"}, {status: 400});
    }
    if(!body.cache_id || !Array.isArray(body.cache_id)){
        return NextResponse.json({error: "Cache ID is required"}, {status: 400});
    }
    if(!body.description && body.description !== ""){
        return NextResponse.json({error: "Description is required"}, {status: 400});
    }
    //Create the key
    const db = new Database();
    let status = 200;
    let data = {};
    try{
        const key = `${Bun.randomUUIDv7()}`;
        data = {key: key};
        await db.createKey(body.name, body.description, body.cache_id, key);
    }
    catch(err){
        console.log(err)
        status = 400;
        data = {error: "Bad Request"};
    }

    await db.close();
    return NextResponse.json(data, {status: status});
}

export async function PATCH(request:NextRequest){
    //Verify the request
    const authHeader = request.headers.get("Authorization");
    if(!authHeader){
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    if(!authHeader.startsWith("Bearer ")){
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    const apiKey = authHeader.split(" ")[1];

    if(!apiKey || !authHeader.startsWith("Bearer ")){
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    //Get the body
    let body;
    try{
        body = await request.json();
    }
    catch(err){
        console.log(err);
        return NextResponse.json({error: "Bad Request"}, {status: 400});
    }
    //Check if the body is valid
    if(!body.cache_id){
        return NextResponse.json({error: "Cache ID is required"}, {status: 400});
    }
    if(!body.keys || !Array.isArray(body.keys) || body.keys.length === 0){
        return NextResponse.json({error: "Keys are required"}, {status: 400});
    }

    //Update the key
    const db = new Database();
    let status = 200;
    let data = {};
    try{
        await db.expandKey(body.cache_id, body.keys);
        data= {message: "Key updated"};
    }
    catch(err){
        console.log(err)
        status = 400;
        data = {error: "Bad Request"};
    }
    await db.close();
    return NextResponse.json(data, {status: status});
}

export async function DELETE(request:NextRequest){
    //Verify the request
    const authHeader = request.headers.get("Authorization");
    if(!authHeader){
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    if(!authHeader.startsWith("Bearer ")){
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    const apiKey = authHeader.split(" ")[1];
    if(!apiKey){
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    //Get the keyID from the request param
    const keyID = request.nextUrl.searchParams.get("key");

    //Get the cacheID from the request param
    const cacheID = request.nextUrl.searchParams.get("cache");

    if(!keyID || !cacheID){
        return NextResponse.json({error: "Key and Cache ID is required"}, {status: 400});
    }

    //Check how many keys are associated with the cache provided, if there is only one key, then refuse the request
    const db = new Database();
    let body = {}
    let status = 200
    try{
        const isAuthenticated = await db.checkKeyForCache(cacheID, apiKey);
        if(!isAuthenticated){
            throw new Error("Unauthorized");
        }
        //Delete the key
        await db.removeKeyFromCache(cacheID, keyID);
        body = {message: "Key deleted"};
    }
    catch(err){
        console.log(err);
        status = 400;
        if(err.message === "Unauthorized"){
            status = 401;
            body = {error: "Unauthorized"};
        }
        else{
            body = {error: "Bad Request"};
        }
    }
    return NextResponse.json(body, {status: status});
}