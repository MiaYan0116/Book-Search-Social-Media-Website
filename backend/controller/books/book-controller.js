import * as booksDao from './books-dao.js';
import * as usersDao from '../users/users-dao.js';
import booksModel from "./books-model.js";
import mongoose from 'mongoose';
import { Types } from 'mongoose';
import usersModel from '../users/users-model.js';

const bookController = (app) => {

    const searchAndSaveBooks = async(req, res) => {
        const searchResults = req.body.searchResults;
        const savedBooks = [];
        for (const externalBookData of searchResults) {
            // const bookId = new mongoose.Types.ObjectId(externalBookData.id);
            const existingBook = await booksDao.findOneBook(externalBookData.id);
            console.log(!existingBook);
            if(!existingBook){
                // Create a new book object based on external API data
                const newBook = {
                    _id: externalBookData.id,
                    title: externalBookData.title,
                    author: externalBookData.author,
                    first_publish_year: externalBookData.first_publish_year,
                    cover_id: externalBookData.cover_id,
                    cover_img: externalBookData.cover_img,
                    edition_count: externalBookData.edition_count,
                    // description: externalBookData.description,
                    // subject_places: externalBookData.subject_places,
                    // subject_times: externalBookData.subject_times,
                    // subjects: externalBookData.subjects,
                    liked: false,
                    likes: [],
                    bookComments: []
                };
                // Save the new book to the internal database
                // const insertedBook = await booksDao.createBook(newBook);
                // savedBooks.push(insertedBook);
                const result = await booksDao.upsertBook(newBook);
                if (result.upserted) {
                    savedBooks.push(newBook);
                }
            }        
        }
        console.log(savedBooks.length);
        res.json(savedBooks);
    }

    const findBooks = async (req, res) => {
        const books = await booksDao.findBooks()
        res.json(books);
    }

    const bookCommentsAndLikes = async (req, res) => {
        const bookId = req.params.bid;
        const book = await booksDao.findOneBook(bookId);
        const commentsAndLikes = {
            comments: book.bookComments,
            likes: book.likes
        }
        res.json(commentsAndLikes);
    }
    
    const updateBook = async(req, res) => {
        const bookId = req.params.bid;
        const updates = req.body;
        const status = await booksDao.updateBook(bookId, updates);
        res.json(status);
    } 

    const addCommentToBook = async(req, res) => {
        const bookId = req.params.bid;
        const commentContent = req.body.comment;
        const user = req.body.user;
        if(!user){
            res.sendStatus(404);
            return;
        }
        const comment = { content: commentContent, user: user, book: bookId, commentTime: new Date()};
        const status = await booksDao.addCommentToBook(bookId, comment);
        const updatedUser = await usersDao.addCommentToUser(user, comment);
        res.json(status);
    }

    // const deleteComment = async(req, res) => {
    //     const contentAdmin = req.session["currentUser"];
    //     if(!contentAdmin || !contentAdmin.isContentAdmin){
    //         res.sendStatus(403);
    //         return;
    //     }
    //     const bookId = req.params.bid;
    //     const commentId = req.params.cid;
    //     const ObjectId = new mongoose.Types.ObjectId(commentId);
    //     const book = await booksModel.findOne({
    //         _id: bookId,
    //         'bookComments._id': ObjectId
    //       }, {
    //         'bookComments.$': 1
    //     });
    //     if (book && book.bookComments && book.bookComments.length > 0) {
    //         const comment = book.bookComments[0];
    //         const userId = comment.user._id; 
    //         const content = comment.content;
    //         const status_book = await booksDao.deleteComment(bookId, commentId);
    //         const status_user = await usersDao.deleteCommentFromUser(userId, content);
    //         res.json(status_book);
    //         console.log(status_user);
    //     }
    // }

    const deleteComment = async(req, res) => {
        console.log("Triggered deletecomment", req.body, req.params, req.body);
        const userIdFromFrontend = req.body.userId;

        // Fetch the user from the database using the userIdFromFrontend
        const userTryingToDelete = await usersModel.findById(userIdFromFrontend);

        if (!userTryingToDelete) {
            console.log("User trying to delete not found");
            res.sendStatus(403);
            return;
        }

        console.log("User trying to delete:", userTryingToDelete);

        const bookId = req.params.bid;
        const commentId = req.params.cid;
        const ObjectId = new mongoose.Types.ObjectId(commentId);
        const book = await booksModel.findOne({
            _id: bookId,
            'bookComments._id': ObjectId
        }, {
            'bookComments.$': 1
        });
        // console.log("Fetched book:", book);

        if (book && book.bookComments && book.bookComments.length > 0) {
            const comment = book.bookComments[0];
            const userId = comment.user._id;
            const content = comment.content;

            // Check if the user trying to delete has the necessary permissions
            if (!userTryingToDelete.isAdmin && !userTryingToDelete.isContentAdmin && userTryingToDelete._id !== userId) {
                console.log("Permission denied for deleting comment");
                res.sendStatus(403);
                return;
            }

            console.log("Deleting comment for book");
            const status_book = await booksDao.deleteComment(bookId, commentId);
            console.log("Deleting comment for user");
            const status_user = await usersDao.deleteCommentFromUser(userId, content);

            res.json(status_book);
        } else {
            console.log("No matching book found with the comment");
            res.status(404).send("Book with the comment not found");
        }
    }

    const addLikeToBook = async(req, res) => {
        const bookId = req.params.bid;
        const user = req.body; 
        if(Object.keys(user).length === 0) {
            res.sendStatus(404);
            return;
        }
        const like = {user: user, book: bookId};
        const status = await booksDao.addLikeToBook(bookId, like);
        const updatedUser = await usersDao.addLikeToUser(user, like);
        res.json(status);
    }

    const detailsInProfile = async(req, res) => {
        const bookId = req.params.bid;
        const book = await booksDao.findOneBook(bookId);
        const details = {
            title: book.title,
            author: book.author,
            comments: book.bookComments,
            likes: book.likes
        }
        console.log(details);
        res.json(details);
    }


    app.post('/api/books', searchAndSaveBooks);
    // app.post('/api/books', createBook);
    app.get('/api/books', findBooks);
    app.get('/api/books/details/:bid', bookCommentsAndLikes);
    app.put('/api/books/:bid', updateBook);
    app.post('/api/books/:bid', addCommentToBook);
    app.put('/api/books/like/:bid', addLikeToBook);
    app.delete('/api/books/:bid/comments/:cid', deleteComment);
    app.get('/api/books/details/profile/:bid', detailsInProfile);
};
export default bookController;