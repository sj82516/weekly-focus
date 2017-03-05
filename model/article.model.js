const moogoose = require('mongoose');

let ArticleSchema = moogoose.Schema({
    title:{
        type: String,
        required:true,
        text: true
    },
    author:{
        type: String,
    },
    intro:{
        type: String,
        required: true,
        text: true
    },
    link:{
        type: String,
        required:true
    },
    content:{
        type: String,
        text: true
    },
    issueId:{
        type: Number,
        required: true,
    },
});

let ArticleModel = moogoose.model('article', ArticleSchema);

module.exports = {
    ArticleModel
};