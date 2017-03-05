const moogoose = require('mongoose');

const SubscriberSchema = moogoose.Schema({
    email:{
        type: String,
        unique: true,
        required:true
    },
    status:{
        type: String,
        enum: ['unconfirm', 'confirmed', 'unsubcribe'],
        default: 'unconfirm',
        required:true
    }
}, {
    timestamps: true
});

module.exports = {
    SubscriberModel: moogoose.model('subscriber', SubscriberSchema)
};