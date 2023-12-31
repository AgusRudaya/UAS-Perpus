const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const app = express();
const port = 3100;

const multer = require("multer");
const upload = multer({ dest: "uploads/" });

const knex = require("knex")(require("./knexfile").development);

app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

// Middleware to check if the user is logged in
const requireLogin = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  } else {
    res.redirect("/");
  }
};

app.set("view engine", "ejs");

// Login page
app.get("/", (req, res) => {
  res.render("login");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  // Query the database to find the user by email
  knex("users")
    .where({ email })
    .first()
    .then((user) => {
      if (user && bcrypt.compareSync(password, user.password)) {
        req.session.userId = user.id;
        res.redirect("/books");
      } else {
        res.redirect("/login");
      }
    })
    .catch((error) => {
      console.error("Error querying the database:", error);
      res.status(500).send("Internal Server Error");
    });
});

app.get("/logout", (req, res) => {
  req.session.destroy(); // Destroy the session to log the user out
  res.redirect("/"); // Redirect to the login page
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", async (req, res) => {
  try {
    const user = req.body;
    const hashedPassword = await bcrypt.hash(user.password, 10);

    await knex("users").insert({
      name: user.name,
      email: user.email,
      password: hashedPassword,
    });

    res.status(200).render("login");
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/books", requireLogin, (req, res) => {
  knex("books")
    .select("*")
    .then((data) => {
      res.render("book", {
        buku: data,
      });
    })
    .catch((error) => console.log(error));
});

app.get("/books/add", requireLogin, (req, res) => {
  res.render("addbook"); // Updated to match the ejs file name
});

app.post("/books/add", upload.single("cover"), requireLogin, (req, res) => {
  const { title, author, isbn, stock, description } = req.body;
  const cover = req.file.filename; // The uploaded file is available as req.file

  knex("books")
    .insert({
      title,
      author,
      isbn,
      stock,
      description,
      cover,
    })
    .then(() => {
      res.redirect("/books");
    })
    .catch((error) => {
      console.error("Error adding the book:", error);
      res.status(500).send("Error adding the book");
    });
});

app.get("/books/edit/:id", requireLogin, (req, res) => {
  const bookId = req.params.id;

  // Retrieve book data from the database based on the bookId
  knex("books")
    .where("id", bookId)
    .first()
    .then((book) => {
      if (!book) {
        return res.status(404).send("Book not found");
      }

      // Render the edit_book.ejs template with the book data
      res.render("editbook", { book });
    })
    .catch((error) => {
      console.log(error);
      res.status(500).send("Error retrieving book data");
    });
});

app.post(
  "/books/update/:id",
  upload.single("cover"),
  requireLogin,
  (req, res) => {
    const bookId = req.params.id;
    const { title, author, isbn, stock, description } = req.body;

    // Check if a file was uploaded
    const cover = req.file ? req.file.filename : undefined;

    knex("books")
      .where({ id: bookId })
      .update({
        title,
        author,
        isbn,
        stock,
        description,
        cover,
        // Add other fields as needed
      })
      .then(() => {
        res.redirect("/books"); // Redirect to the books page after updating a book
      })
      .catch((error) => {
        console.log(error);
        res.status(500).send("Error updating the book");
      });
  }
);

app.post("/books/delete/:id", requireLogin, (req, res) => {
  const bookId = req.params.id;

  knex("books")
    .where({ id: bookId })
    .del()
    .then(() => {
      res.redirect("/books"); // Redirect to the books page after deleting a book
    })
    .catch((error) => {
      console.log(error);
      res.status(500).send("Error deleting the book");
    });
});

app.get("/books/search", requireLogin, (req, res) => {
  const searchTerm = req.query.search;

  knex("books")
    .where("isbn", "like", `%${searchTerm}%`)
    .orWhere("title", "like", `%${searchTerm}%`)
    .then((results) => {
      res.render("book", { buku: results });
    })
    .catch((error) => {
      console.log(error);
      res.status(500).send("Error searching books");
    });
});

// Route to display all members
app.get("/members", requireLogin, (req, res) => {
  knex("members")
    .select("*")
    .then((data) => {
      res.render("member", {
        members: data,
      });
    })
    .catch((error) => console.log(error));
});

// Route to display the add member form
app.get("/members/add", requireLogin, (req, res) => {
  res.render("addmember"); // Update to match your ejs file name
});

// Route to handle adding a new member
app.post("/members/add", requireLogin, (req, res) => {
  const { name, code, email, phone, address } = req.body;

  knex("members")
    .insert({
      name,
      code,
      email,
      phone,
      address,
    })
    .then(() => {
      res.redirect("/members");
    })
    .catch((error) => {
      console.error("Error adding the member:", error);
      res.status(500).send("Error adding the member");
    });
});

// Route to display the edit member form
app.get("/members/edit/:id", requireLogin, (req, res) => {
  const memberId = req.params.id;

  knex("members")
    .where("id", memberId)
    .first()
    .then((member) => {
      if (!member) {
        return res.status(404).send("Member not found");
      }

      res.render("editmember", { member });
    })
    .catch((error) => {
      console.log(error);
      res.status(500).send("Error retrieving member data");
    });
});

// Route to handle updating a member
app.post("/members/update/:id", requireLogin, (req, res) => {
  const memberId = req.params.id;
  const { name, code, email, phone, address } = req.body;

  knex("members")
    .where({ id: memberId })
    .update({
      name,
      code,
      email,
      phone,
      address,
      // Add other fields as needed
    })
    .then(() => {
      res.redirect("/members");
    })
    .catch((error) => {
      console.log(error);
      res.status(500).send("Error updating the member");
    });
});

// Route to handle deleting a member
app.post("/members/delete/:id", requireLogin, (req, res) => {
  const memberId = req.params.id;

  knex("members")
    .where({ id: memberId })
    .del()
    .then(() => {
      res.redirect("/members");
    })
    .catch((error) => {
      console.log(error);
      res.status(500).send("Error deleting the member");
    });
});

// Route to handle searching members
app.get("/members/search", requireLogin, (req, res) => {
  const searchTerm = req.query.search;

  knex("members")
    .where("name", "like", `%${searchTerm}%`)
    .orWhere("code", "like", `%${searchTerm}%`)
    .then((results) => {
      res.render("member", { members: results });
    })
    .catch((error) => {
      console.log(error);
      res.status(500).send("Error searching members");
    });
});

function formatDate(dateString) {
  try {
    if (dateString === null) {
      return "Not returned yet";
    }

    const date = new Date(dateString);
    return date.toLocaleDateString(); // Adjust the format as needed
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Invalid Date";
  }
}

// Route to display all borrowings with book and member names
app.get("/borrowings", requireLogin, async (req, res) => {
  try {
    const borrowings = await knex("borrowings")
      .select(
        "borrowings.*",
        "books.title as bookName",
        "members.name as memberName"
      )
      .leftJoin("books", "borrowings.book_id", "books.id")
      .leftJoin("members", "borrowings.member_id", "members.id");

    // debug output
    // console.log("Borrowings:", borrowings);

    res.render("borrowing", {
      borrowings: borrowings.map((item) => ({
        ...item,
        borrow_date: formatDate(item.borrow_date),
        return_date: formatDate(item.return_date),
        returned_date: formatDate(item.returned_date),
      })),
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

// Route to render the form with error messages
app.get("/borrowings/add", requireLogin, async (req, res) => {
  try {
    const books = await knex("books").select("id", "title");
    const members = await knex("members").select("id", "name");

    // Pass error messages as needed
    res.render("addborrowing", {
      books,
      members,
      memberLimitError: req.query.memberLimitError,
      bookOutOfStockError: req.query.bookOutOfStockError,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

const MAX_BORROWED_BOOKS = 3; // Maximum number of books a member can borrow

// Route to handle form submission
app.post("/borrowings/add", requireLogin, async (req, res) => {
  try {
    const { book_id, member_id, borrow_date, return_date } = req.body;

    // Check if the member has already borrowed the maximum number of books
    const borrowedBooksCount = await knex("borrowings")
      .where({ member_id, status: "not_returned" })
      .count("id as count")
      .first();

    if (borrowedBooksCount.count >= MAX_BORROWED_BOOKS) {
      return res.redirect(
        "/borrowings/add?memberLimitError=Member has reached the maximum limit of borrowed books."
      );
    }

    // Check if the book is available (stock > 0) before proceeding
    const book = await knex("books")
      .select("id", "title", "stock")
      .where({ id: book_id })
      .first();

    if (!book || book.stock <= 0) {
      // Book is not available
      return res.redirect(
        "/borrowings/add?bookOutOfStockError=Book is out of stock."
      );
    }

    // Insert the borrowing into the database and decrement the book stock
    await knex.transaction(async (trx) => {
      // Update book stock (decrement by 1)
      await trx("books").where({ id: book_id }).decrement("stock", 1);

      // Insert the borrowing record
      await trx("borrowings").insert({
        book_id,
        member_id,
        borrow_date,
        return_date,
        returned_date: null,
        fine: 0.0,
        status: "not_returned",
      });
    });

    res.redirect("/borrowings");
  } catch (error) {
    console.error("Error adding new borrowing:", error);
    res.status(500).send("Error adding new borrowing");
  }
});

app.post("/borrowings/delete/:id", requireLogin, async (req, res) => {
  try {
    const borrowingId = req.params.id;

    // Delete the borrowing from the database
    await knex("borrowings").where({ id: borrowingId }).del();

    res.redirect("/borrowings");
  } catch (error) {
    console.error("Error deleting borrowing:", error);
    res.status(500).send("Error deleting borrowing");
  }
});

// Route to render the update form
app.get("/borrowings/edit/:id", requireLogin, async (req, res) => {
  try {
    const { id } = req.params;
    const borrowing = await knex("borrowings").where({ id }).first();

    if (!borrowing) {
      return res.status(404).send("Borrowing not found");
    }

    res.render("editborrowing", { borrowing });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// Route to handle form submission for updating borrowing status
app.post("/borrowings/edit/:id", requireLogin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const borrowing = await knex("borrowings").where({ id }).first();

    if (!borrowing) {
      return res.status(404).send("Borrowing not found");
    }

    let fine = 0;

    if (status === "returned") {
      // If status is "returned," update returned_date to the current date
      await knex("borrowings").where({ id }).update({
        status,
        returned_date: new Date(),
      });

      // Calculate fine if returned after the due date
      const returnDate = new Date(borrowing.return_date);
      const currentDate = new Date();

      if (currentDate > returnDate) {
        const daysOverdue = Math.floor(
          (currentDate - returnDate) / (1000 * 60 * 60 * 24)
        );
        fine = daysOverdue * 500; // Assuming a fine of 500 per day overdue
      }

      // Update book stock (increment by 1)
      await knex("books")
        .where({ id: borrowing.book_id })
        .increment("stock", 1);
    } else {
      // If status is not "returned," update only the status
      await knex("borrowings").where({ id }).update({
        status,
      });
    }

    // Update the fine in the database
    await knex("borrowings").where({ id }).update({
      fine,
    });

    res.redirect("/borrowings");
  } catch (error) {
    console.error("Error updating borrowing:", error);
    res.status(500).send("Error updating borrowing");
  }
});

// Route to handle searching borrowings
app.get("/borrowings/search", requireLogin, async (req, res) => {
  try {
    const searchTerm = req.query.search;

    const results = await knex("borrowings")
      .select(
        "borrowings.*",
        "members.name as memberName",
        "books.title as bookName" // Change property name to match main route
      )
      .leftJoin("members", "borrowings.member_id", "members.id")
      .leftJoin("books", "borrowings.book_id", "books.id")
      .where((builder) => {
        builder
          .orWhere("members.name", "like", `%${searchTerm}%`)
          .orWhere("books.title", "like", `%${searchTerm}%`);
      });

    // Format dates in the results
    const formattedResults = results.map((item) => ({
      ...item,
      borrow_date: formatDate(item.borrow_date),
      return_date: formatDate(item.return_date),
      returned_date: formatDate(item.returned_date),
    }));

    res.render("borrowing", { borrowings: formattedResults });
  } catch (error) {
    console.log(error);
    res.status(500).send("Error searching borrowings");
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
