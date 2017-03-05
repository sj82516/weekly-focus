const moogoose = require('mongoose');

const IssueSchema = moogoose.Schema({
    id: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    }
});


module.exports = {
    IssueModel: moogoose.model('issue', IssueSchema)
};