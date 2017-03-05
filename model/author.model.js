const moogoose = require('mongoose');

const AuthorSchema = moogoose.Schema({
    account:{
        type: String,
        unique: true,
        required:true
    },
    password:{
        type: String,
        required:true
    },
    username:{
        type: String,
        index: true,
        unique: true,
        required:true
    }
});

module.exports = {
    AuthorModel: moogoose.model('author', AuthorSchema)
};