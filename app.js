const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");

const app = express();

// Connect to the MongoDB database
mongoose
  .connect(
    "mongodb+srv://kislaykaushik8:RW7d9MsO0QmREweT@cluster0.kbu2zrp.mongodb.net/Blog?retryWrites=true&w=majority"
  )
  .then(() => app.listen(5000))
  .then(() => console.log("Connected to Db"))
  .catch((err) => console.log(err));

// Define middleware to parse JSON request bodies
app.use(bodyParser.json());

// Define a secret key for JWT token generation
const secretKey = "mysecretkey";

// Define the schema for the User collection
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

// Define the schema for the Post collection
const postSchema = new mongoose.Schema({
  title: String,
  description: String,
  created_at: { type: Date, default: Date.now },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  unlikes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
});

// Define the schema for the Comment collection
const commentSchema = new mongoose.Schema({
  text: String,
  created_at: { type: Date, default: Date.now },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  post: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
});

// Define the models for the User, Post, and Comment collections
const User = mongoose.model("User", userSchema);
const Post = mongoose.model("Post", postSchema);
const Comment = mongoose.model("Comment", commentSchema);

// Define a middleware function to verify the JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null)
    return res.status(401).json({ message: "Authorization token" });

  jwt.verify(token, secretKey, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Perform user authentication and return a JWT token
app.post("/api/authenticate", (req, res) => {
  // Use dummy email and password for authentication
  const email = "test@example.com";
  const password = "password";

  if (req.body.email !== email || req.body.password !== password) {
    return res.sendStatus(401);
  }

  const token = jwt.sign({ email }, secretKey, { expiresIn: "1h" });
  res.json({ token });
});

app.post("/api/users", async (req, res) => {
  try {
    // Create a new user from the request body
    const user = new User({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
    });

    // Save the user to the database
    await user.save();

    // Return the saved user
    res.json(user);
  } catch (err) {
    // Handle any errors
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/user", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId);
    const followersCount = user?.followers.length;
    const followingCount = user?.following.length;

    res.json({
      name: user?.name,
      followers: followersCount,
      following: followingCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Add a new post
app.post("/api/posts", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { title, description } = req.body;

    const post = new Post({ title, description, createdBy: userId });
    await post.save();

    res.json({
      id: post._id,
      title: post.title,
      desc: post.description,
      created_at: post.createdAt,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Follow a user

app.post("/api/follow/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const followId = req.params.id;

    // Find the user to follow
    const userToFollow = await User.findById(followId);
    if (!userToFollow) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if the authenticated user is already following the user
    if (userToFollow.followers.includes(userId)) {
      return res.status(400).json({ error: "User is already being followed" });
    }

    // Update the user's followers and the authenticated user's following
    userToFollow.followers.push(userId);
    await userToFollow.save();
    const authenticatedUser = await User.findById(userId);
    authenticatedUser.following.push(followId);
    await authenticatedUser.save();

    res.json({ message: `User ${followId} has been followed` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// // Unfollow a user

app.post("/api/unfollow/:id", authenticateToken, async (req, res) => {
  try {
    // Get the authenticated user's id
    const userId = req.userId;

    // Get the user to unfollow's id from the request params
    const unfollowUserId = req.params.id;

    // Check if the authenticated user is already following the user to unfollow
    const user = await User.findById(userId);
    const index = user?.following.indexOf(unfollowUserId);
    if (index === -1) {
      return res
        .status(400)
        .json({ message: "You are not following this user." });
    }

    // Remove the unfollowed user's id from the authenticated user's following list
    user?.following.splice(index, 1);
    await user?.save();

    // Remove the authenticated user's id from the unfollowed user's followers list
    const unfollowUser = await User.findById(unfollowUserId);
    const unfollowIndex = unfollowUser.followers.indexOf(userId);
    if (unfollowIndex > -1) {
      unfollowUser.followers.splice(unfollowIndex, 1);
      await unfollowUser.save();
    }

    // Return a success message
    res.status(200).json({ message: "Unfollowed user successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// app.post("/api/unfollow/:id", authenticateToken, async (req, res) => {
//   try {
//     const userId = req.userId;
//     const unfollowId = req.params.id;

//     // Check if user already follows the target user
//     const currentUser = await User.findById(userId);
//     if (!currentUser.following.includes(unfollowId)) {
//       return res.status(400).json({ message: "User not in following list" });
//     }

//     // Remove the target user from the current user's following list
//     currentUser.following.pull(unfollowId);
//     await currentUser.save();

//     // Remove the current user from the target user's followers list
//     const targetUser = await User.findById(unfollowId);
//     targetUser.followers.pull(userId);
//     await targetUser.save();

//     res.json({ message: "Successfully unfollowed user" });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// });

// DELETE api/posts/{id} would delete post with {id} created by the authenticated user.

app.delete("/api/posts/:id", authenticateToken, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }
  try {
    await Post.deleteOne({ _id: post._id });
    res.json({ message: "Post deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE2ODIxNDgzOTAsImV4cCI6MTY4MjE1MTk5MH0.o-m1qEa73obcNufpUpk1HHnX1olgRiIdfSP_fyecn3Y

// app.delete("/api/posts/:id", authenticateToken, async (req, res) => {
//   const postId = req.params.id;

//   try {
//     // Find the post by ID
//     const post = await Post.findOne({ _id: postId });
//     if (!post) {
//       return res.status(404).json({ error: "Post not found" });
//     }

//     // Check if authenticated user created the post
//     if (post.author.toString() !== req.user._id) {
//       return res.status(401).json({ error: "Unauthorized" });
//     }

//     // Delete the post
//     await post.remove();

//     res.json({ message: "Post deleted successfully" });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// POST /api/like/{id} would like the post with {id} by the authenticated user.
app.post("/api/like/:id", authenticateToken, async (req, res) => {
  const postId = req.params.id;

  try {
    // Find the post by ID
    const post = await Post.findOne({ _id: postId });
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Check if the authenticated user has already liked the post
    if (post.likes.includes(req.user._id)) {
      return res.status(400).json({ error: "Already liked" });
    }

    // Add the user to the likes array
    post.likes.push(req.user._id);
    await post.save();

    res.json({ message: "Post liked successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/unlike/{id} would unlike the post with {id} by the authenticated user.
app.post("/api/unlike/:id", authenticateToken, async (req, res) => {
  const postId = req.params.id;

  try {
    // Find the post by ID
    const post = await Post.findOne({ _id: postId });
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    post.unlikes.push(req.user._id);
    // Check if the authenticated user has liked the post
    if (!post.unlikes.includes(req.user._id)) {
      return res.status(400).json({ error: "Not liked" });
    }

    // Remove the user from the likes array
    //post.likes = post.likes.filter((id) => id !== req.user._id);
    await post.save();

    res.json({ message: "Post unliked successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/comment/{id}

// app.post('/api/comment/:id', authenticateToken, (req, res) => {
//   const userId = req.user.id;
//   const postId = req.params.id;
//   const comment = req.body.comment;

//   // Check if comment is present
//   if (!comment) {
//     return res.status(400).json({ error: 'Comment cannot be empty' });
//   }

//   // Find the post
//   Post.findById(postId)
//     .then((post) => {
//       // Check if post exists
//       if (!post) {
//         return res.status(404).json({ error: 'Post not found' });
//       }

//       // Add comment to post
//       post.comments.unshift({ user: userId, comment: comment });
//       post.save()
//         .then(() => {
//           return res.status(200).json({ message: 'Comment added successfully' });
//         })
//         .catch((err) => {
//           console.error(err);
//           return res.status(500).json({ error: 'Internal server error' });
//         });
//     })
//     .catch((err) => {
//       console.error(err);
//       return res.status(500).json({ error: 'Internal server error' });
//     });
// });

app.post("/api/comment/:id", authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const comment = new Comment({
      user: user.id,
      post: post.id,
      text: req.body.text,
    });

    await comment.save();

    post.comments.push(comment.id);
    await post.save();

    res.json({ message: "Comment added", comment_id: comment.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

// GET a single post with id
app.get("/api/posts/:id", authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("likes")
      .populate("comments");
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET all posts created by authenticated user sorted by post time
app.get("/api/all_posts", authenticateToken, async (req, res) => {
  try {
    const posts = await Post.find({ createdBy: req.user.id })
      .populate("likes")
      .populate({
        path: "comments",
        populate: {
          path: "createdBy",
          select: "name",
        },
      })
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});
