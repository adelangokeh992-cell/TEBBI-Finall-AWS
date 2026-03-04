"""
Database connection for Tebbi.
Single place for MongoDB client and db instance.
"""
from motor.motor_asyncio import AsyncIOMotorClient

from config import settings

client = AsyncIOMotorClient(settings.mongo_url)
db = client[settings.db_name]
