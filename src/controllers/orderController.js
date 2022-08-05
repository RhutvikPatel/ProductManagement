const userModel = require("../models/userModel");
const cartModel = require("../models/cartModel");
const orderModel = require("../models/orderModel");
const { isValidRequestBody, isValidObjectId, isValidStatus } = require('../validators/validate')

//=======================================================================================

const orderCreation = async (req, res) => {
    try {
        let userId = req.params.userId;
        let requestBody = req.body;

        let { cartId, status, cancellable } = requestBody;

        if(requestBody.hasOwnProperty('cancellable')){
            if ((typeof cancellable !== "boolean")) {
                return res.status(400).send({ status: false, message: "cancellable should be a boolean value" });
            }
        }


        if (!isValidObjectId(userId)) {
            return res.status(400).send({ status: false, message: "Invalid userId in params." });
        }

        if (!isValidRequestBody(requestBody)) {
            return res.status(400).send({ status: false, message: "Invalid request body. Please provide the the input to proceed." });
        }

        if (!cartId) {
            return res.status(400).send({ status: false, message: `Cart Id is required` });
        }

        if (!isValidObjectId(cartId)) {
            return res.status(400).send({ status: false, message: `Invalid cartId in request body.` });
        }
        
        if (status) {
            if (status !== 'pending') {
                return res.status(400).send({ status: false, message: "status must be Pending during creation of order" })
            }
        }

            const searchUser = await userModel.findOne({ _id: userId });

            if (!searchUser) {
                return res.status(404).send({ status: false, message: `user doesn't exist for ${userId}` });
            }

            const searchCartDetails = await cartModel.findOne({ _id: cartId, userId: userId });

            if (!searchCartDetails) {
                return res.status(404).send({ status: false, message: `Cart doesn't belongs to ${userId}` });
            }

            if (!searchCartDetails.items.length) {
                return res.status(404).send({ status: false, message: `Please add some product in cart to make an order.` });
            }

            //adding quantity of every products

            const reducer = (previousValue, currentValue) => previousValue + currentValue;

            let totalQuantity = searchCartDetails.items.map((x) => x.quantity).reduce(reducer);

            const orderDetails = {
                userId: userId,
                items: searchCartDetails.items,
                totalPrice: searchCartDetails.totalPrice,
                totalItems: searchCartDetails.totalItems,
                totalQuantity: totalQuantity,
                cancellable,
                status,
            };
            const savedOrder = await orderModel.create(orderDetails);

            //Empty the cart after the successfull order

            if (status == 'pending' || savedOrder.status == 'pending') {
                await cartModel.findOneAndUpdate({ _id: cartId, userId: userId }, {
                    $set: {
                        items: [],
                        totalPrice: 0,
                        totalItems: 0,
                    },
                })
            };
            return res.status(201).send({ status: true, message: "Order placed.", data: savedOrder });
        }
    catch (error) {
        return res.status(500).send({ status: false, message: error.message });
    }
};

//=======================================================================================

const updateOrder = async function (req, res) {
    try {
        const userId = req.params.userId
        const { orderId, status } = req.body

        if (!orderId || orderId == "") {
            return res.status(400).send({ status: false, message: "Order Id is required" })
        }

        if (!status) {
            return res.status(400).send({ status: false, message: "Status is required" })
        }

        if (!isValidObjectId(orderId)) {
            return res.status(400).send({ status: false, message: "Please provide a valid orderId " })
        }

        if (!isValidStatus(status)) {
            return res.status(400).send({ status: false, message: "Status can be completed or cancelled only" })
        }

        if (status == 'pending') {
            return res.status(400).send({ status: false, message: "status can not be pending during updation" })
        }

        const order = await orderModel.findOne({ _id: orderId, isDeleted: false, userId: userId })

        if (!order) {
            return res.status(404).send({ status: false, message: "Order not found for this userId" })
        }

        if (status == 'cancelled' && order.cancellable == false) {
            return res.status(400).send({ status: false, message: "Order is not cancellable" })
        }

        if (status == 'completed' && (order.status == 'completed' || order.status == 'cancelled')) {
            return res.status(400).send({ status: false, message: `Order status can not be changed after ${order.status}` })
        }

        if (status == 'cancelled' && (order.status == 'completed' || order.status == 'cancelled')) {
            return res.status(400).send({ status: false, message: `Order status can not be changed after ${order.status}` })
        }

        if (status == 'completed' && order.status == 'pending') {
            const orderCompleted = await orderModel.findOneAndUpdate({ _id: orderId }, { $set: { status: 'completed' } }, { new: true })
            return res.status(200).send({ status: true, message: "Order is completed", data: orderCompleted })
        }

        if (status == 'cancelled' && order.status == 'pending') {
            const orderCancelled = await orderModel.findOneAndUpdate({ _id: orderId }, { $set: { status: 'cancelled' } }, { new: true })
            return res.status(200).send({ status: true, message: "Order is cancelled", data: orderCancelled })
        }
    } catch (error) {
        return res.status(500).send({ status: false, error: error.message })
    }
}

//=======================================================================================

module.exports = { orderCreation, updateOrder }

//=======================================================================================