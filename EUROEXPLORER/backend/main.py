from fastapi import FastAPI, Depends, HTTPException, status, Header, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import jwt
import bcrypt
import datetime
import json
import os
import shutil
from bson.objectid import ObjectId

from mongo_db import init_mongo, users_collection, countries_collection, commits_collection

app = FastAPI(title="Europa Explorer CMS API - MongoDB")

# Initialize DB on startup
init_mongo()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = "super_secret_key_europa_explorer"
ALGORITHM = "HS256"

os.makedirs("uploads", exist_ok=True)

class LoginRequest(BaseModel):
    username: str
    password: str

class CommitProposal(BaseModel):
    country_id: str
    message: str
    diff: Dict[str, Any]

class RejectRequest(BaseModel):
    note: str

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_super_admin(user: dict = Depends(get_current_user)):
    if user.get("role") != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Super Admin required")
    return user

@app.post("/api/auth/login")
def login(req: LoginRequest):
    user = users_collection.find_one({"username": req.username})
    if not user or not bcrypt.checkpw(req.password.encode('utf-8'), user['password'].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token_data = {"sub": str(user['_id']), "username": user['username'], "role": user['role']}
    token = jwt.encode({**token_data, "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24)}, SECRET_KEY, algorithm=ALGORITHM)
    
    return {"access_token": token, "user": token_data}

@app.get("/api/countries")
def get_countries():
    countries = list(countries_collection.find({}, {"content": 0}))
    for c in countries: c["_id"] = str(c["_id"])
    return countries

@app.get("/api/countries/{country_id}")
def get_country(country_id: str):
    country = countries_collection.find_one({"id": country_id})
    if not country:
        return {"id": country_id, "name": country_id, "content": {"sections": [], "images": []}}
    country["_id"] = str(country["_id"])
    return country

@app.post("/api/commits")
def create_commit(proposal: CommitProposal, user: dict = Depends(get_current_user)):
    if not countries_collection.find_one({"id": proposal.country_id}):
        countries_collection.insert_one({
            "id": proposal.country_id,
            "name": proposal.country_id,
            "content": {"sections": [], "images": []}
        })
    
    commit_doc = {
        "country_id": proposal.country_id,
        "author_id": user['sub'],
        "author_name": user['username'],
        "status": "PENDING",
        "created_at": datetime.datetime.utcnow(),
        "message": proposal.message,
        "diff": proposal.diff,
        "rejection_note": None
    }
    commits_collection.insert_one(commit_doc)
    return {"message": "Proposal submitted successfully"}

@app.get("/api/commits")
def list_commits(user: dict = Depends(require_super_admin)):
    commits = list(commits_collection.find().sort("created_at", -1))
    for c in commits: c["_id"] = str(c["_id"])
    return commits

@app.get("/api/commits/me")
def list_my_commits(user: dict = Depends(get_current_user)):
    commits = list(commits_collection.find({"author_id": user['sub']}).sort("created_at", -1))
    for c in commits: c["_id"] = str(c["_id"])
    return commits

@app.post("/api/commits/{commit_id}/approve")
def approve_commit(commit_id: str, user: dict = Depends(require_super_admin)):
    commit = commits_collection.find_one({"_id": ObjectId(commit_id)})
    if not commit: raise HTTPException(status_code=404, detail="Commit not found")
    if commit['status'] != 'PENDING': raise HTTPException(status_code=400, detail="Commit already processed")
        
    # Apply diff to country content completely
    countries_collection.update_one(
        {"id": commit['country_id']},
        {"$set": {"content": commit['diff']}}
    )
    commits_collection.update_one({"_id": ObjectId(commit_id)}, {"$set": {"status": "APPROVED"}})
    return {"message": "Approved and applied"}

@app.post("/api/commits/{commit_id}/reject")
def reject_commit(commit_id: str, req: RejectRequest, user: dict = Depends(require_super_admin)):
    result = commits_collection.update_one(
        {"_id": ObjectId(commit_id)},
        {"$set": {"status": "REJECTED", "rejection_note": req.note}}
    )
    if result.matched_count == 0: raise HTTPException(status_code=404, detail="Commit not found")
    return {"message": "Rejected"}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    file_location = f"uploads/{file.filename}"
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
    return {"url": f"http://localhost:8000/uploads/{file.filename}"}

from fastapi.staticfiles import StaticFiles
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
