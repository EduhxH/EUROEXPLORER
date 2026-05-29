from pymongo import MongoClient
import bcrypt
import os

MONGO_URI = "mongodb+srv://eduardolegal:pass1234@cluster0.40sjew2.mongodb.net/?appName=Cluster0"
client = MongoClient(MONGO_URI)
db = client['europa_explorer']

users_collection = db['users']
countries_collection = db['countries']
commits_collection = db['commits']

def init_mongo():
    if users_collection.count_documents({}) == 0:
        print("Seeding initial users to MongoDB...")
        super_admins = [
            {'username': 'EduDev', 'password': 'eduardo0099', 'role': 'SUPER_ADMIN'},
            {'username': 'filipe', 'password': 'pass22314', 'role': 'SUPER_ADMIN'},
            {'username': 'Valeri', 'password': 'pass23145', 'role': 'SUPER_ADMIN'}
        ]
        standard_admins = [
            {'username': 'Afonso', 'password': 'c2GIoePJ3eyc'},
            {'username': 'André', 'password': 'o487FIvGdeUL'},
            {'username': 'Cauã', 'password': '8iP6x2P2R05A'},
            {'username': 'Claudio', 'password': 'bc1BKUXpIryc'},
            {'username': 'Damian', 'password': 'fbi5FCd3uFwm'},
            {'username': 'David', 'password': 'SfWYesp8SRob'},
            {'username': 'Diogo', 'password': '9HbFrrUj7yHy'},
            {'username': 'Henry', 'password': 'nY1nx96jbHtq'},
            {'username': 'Krysthyan', 'password': 'RkDcYK8nq8lp'},
            {'username': 'Martim fofo', 'password': 'vwpJq17vyGQR'},
            {'username': 'Raphel', 'password': 'FdMe1OJrGl1H'},
            {'username': 'Simão Baptista', 'password': 'QnmI758R2fuw'},
            {'username': 'Simão Babão', 'password': 'VC3Doa6bsn89'},
            {'username': 'Thiago', 'password': 'SMPwtPXUJAmN'},
            {'username': 'Tomás', 'password': 'b6RHQ3peHBKZ'},
            {'username': 'Vicente', 'password': '5TVm9KX6sj39'},
            {'username': 'Caleb', 'password': 't3ujqDtEPm30'}
        ]
        
        users_to_insert = []
        for admin in super_admins + standard_admins:
            role = admin.get('role', 'STANDARD_ADMIN')
            hashed = bcrypt.hashpw(admin['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            users_to_insert.append({
                'username': admin['username'],
                'password': hashed,
                'role': role,
                'avatar': None
            })
            
        users_collection.insert_many(users_to_insert)
        print("Users seeded successfully.")

if __name__ == "__main__":
    init_mongo()
