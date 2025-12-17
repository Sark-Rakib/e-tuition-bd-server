const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();

const port = process.env.PORT || 4000;

// middlewere
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.PASSWORD_DB}@cluster0.oibnujx.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db = client.db("e-tution-bd");
    const tuitionsCollection = db.collection("tuitions");
    const tutorsCollection = db.collection("tutors");
    const userColl = db.collection("users");
    const paymentColl = db.collection("payments");

    // jwt

    // user related api

    app.get("/users", async (req, res) => {
      const cursor = userColl.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "user";
      user.createdAt = new Date();
      const email = user.email;
      const userExists = await userColl.findOne({ email });
      if (userExists) {
        return res.send({ message: "user exists" });
      }

      const result = await userColl.insertOne(user);
      res.send(result);
    });

    // Make user an admin
    app.patch("/users/:id/admin", async (req, res) => {
      const { id } = req.params;
      const result = await userColl.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: "admin" } }
      );
      res.send(result);
    });

    // Tuition post (Student)
    app.post("/tuitions", async (req, res) => {
      const tuitionData = req.body;
      const result = await tuitionsCollection.insertOne(tuitionData);
      // Role update only if user doesn't exist or doesn't have a role yet
      const user = await userColl.findOne({ email: tuitionData.studentEmail });
      if (user && !user.role) {
        await userColl.updateOne(
          { email: tuitionData.studentEmail },
          { $set: { role: "student", updatedAt: new Date() } }
        );
      }
      res.send(result);
    });

    // tuition
    app.get("/tuitions", async (req, res) => {
      try {
        const tuitions = await tuitionsCollection
          .find({})
          .sort({ postedAt: -1 })
          .toArray();

        // প্রতিটি tuition-এর সাথে student-এর role যাচাই করে পাঠান (optional, frontend-এও করা যায়)
        res.send(tuitions);
      } catch (error) {
        res.status(500).send({ message: "Error fetching tuitions" });
      }
    });

    // tuition details page
    app.get("/tuitions/:id", async (req, res) => {
      const { id } = req.params;
      const tuition = await tuitionsCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!tuition)
        return res.status(404).send({ message: "Tuition not found" });

      res.send(tuition);
    });

    // Tutor postt
    app.post("/tutors", async (req, res) => {
      const tutorData = req.body;

      const result = await tutorsCollection.insertOne(tutorData);

      // Role update: tutor
      await userColl.updateOne(
        { email: tutorData.tutorEmail },
        { $set: { role: "tutor", updatedAt: new Date() } },
        { upsert: true }
      );

      res.send(result);
    });

    // tutor details page

    app.get("/tutors/:id", async (req, res) => {
      const { id } = req.params;

      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid tutor ID" });
        }

        const tutor = await tutorsCollection.findOne({ _id: new ObjectId(id) });

        if (!tutor) {
          return res.status(404).send({ message: "Tutor not found" });
        }

        res.send(tutor);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // সব tutor profiles (শুধু tutor role দের)
    app.get("/tutors", async (req, res) => {
      const tutors = await tutorsCollection
        .find()
        .sort({ postedAt: -1 })
        .toArray();
      res.send(tutors);
    });

    // // POST new tuition (Student)
    // app.post("/tuitions", async (req, res) => {
    //   const formData = req.body;

    //   const newTuition = {
    //     title: formData.title,
    //     studentClass: formData.studentClass,
    //     subject: formData.subject,
    //     location: formData.location,
    //     salary: Number(formData.salary), // স্ট্রিং থেকে নাম্বার
    //     daysPerWeek: Number(formData.daysPerWeek),
    //     tutoringTime: formData.tutoringTime,
    //     studentGender: formData.studentGender || null,
    //     tutorGender: formData.tutorGender,
    //     requirements: formData.requirements,
    //     contactPhone: formData.contactPhone,
    //     studentName: formData.studentName,
    //     studentEmail: formData.studentEmail,
    //     studentPhoto: formData.studentPhoto,
    //     status: "Approved", // এডমিন এপ্রুভ করবে
    //     postedAt: new Date(),
    //   };
    //   const result = await tuitionsCollection.insertOne(newTuition);
    //   res.send(result);
    // });

    // // get api

    // app.get("/tuitions", async (req, res) => {
    //   const tuitions = await tuitionsCollection
    //     .find({ status: "Approved" })
    //     .sort({ postedAt: -1 })
    //     .toArray();
    //   res.send({ success: true, data: tuitions });
    // });

    // GET all approved tuitions (Public)
    // app.get("/tuitions", async (req, res) => {
    //   const tuitions = await tuitionColl
    //     .find({ status: "Approved" })
    //     .sort({ postedAt: -1 })
    //     .toArray(); // native driver
    //   res.send({ success: true, data: tuitions });
    // });

    // // Admin: Approve/Reject
    // app.patch("/tuitions/:id/approve", async (req, res) => {
    //   const { id } = req.params;
    //   const result = await tuitionColl.updateOne(
    //     { _id: new ObjectId(id) },
    //     { $set: { status: "Approved" } }
    //   );
    //   res.send({ success: true, message: "Tuition approved" });
    // });

    // app.get("/tuitions", async (req, res) => {
    //   try {
    //     const tuitions = await tuitionColl
    //       .find({ status: "Approved" })
    //       .sort({ postedAt: -1 })
    //       .toArray();
    //     res.send({ success: true, data: tuitions });
    //   } catch (err) {
    //     console.error(err);
    //     res
    //       .status(500)
    //       .send({ success: false, message: "Failed to fetch tuitions" });
    //   }
    // });

    // // Get Pending Tuitions (Admin view)
    // app.get("/tuitions/pending", async (req, res) => {
    //   try {
    //     const tuitions = await tuitionColl
    //       .find({ status: "Pending" })
    //       .sort({ postedAt: -1 })
    //       .toArray();
    //     res.send({ success: true, data: tuitions });
    //   } catch (err) {
    //     res.status(500).send({
    //       success: false,
    //       message: "Failed to fetch pending tuitions",
    //     });
    //   }
    // });

    // // Approve Tuition (Admin)
    // app.patch("/tuitions/:id/approve", async (req, res) => {
    //   const { id } = req.params;
    //   if (!ObjectId.isValid(id))
    //     return res.status(400).send({ success: false, message: "Invalid ID" });

    //   const result = await tuitionColl.updateOne(
    //     { _id: new ObjectId(id) },
    //     { $set: { status: "Approved" } }
    //   );

    //   if (result.modifiedCount === 0)
    //     return res.status(404).send({
    //       success: false,
    //       message: "Tuition not found or already approved",
    //     });

    //   res.send({ success: true, message: "Tuition approved" });
    // });

    // // Reject Tuition (Admin)
    // app.patch("/tuitions/:id/reject", async (req, res) => {
    //   const { id } = req.params;
    //   if (!ObjectId.isValid(id))
    //     return res.status(400).send({ success: false, message: "Invalid ID" });

    //   const result = await tuitionColl.updateOne(
    //     { _id: new ObjectId(id) },
    //     { $set: { status: "Rejected" } }
    //   );

    //   if (result.modifiedCount === 0)
    //     return res.status(404).send({
    //       success: false,
    //       message: "Tuition not found or already rejected",
    //     });

    //   res.send({ success: true, message: "Tuition rejected" });
    // });

    // ১. সব এপ্রুভড তুইশন (পাবলিক)
    // app.get("/tuitions", async (req, res) => {
    //   try {
    //     const tuitions = await tuitionsCollection
    //       .find({ status: "Approved" })
    //       .sort({ postedAt: -1 })
    //       .toArray();
    //     res.send({ success: true, data: tuitions });
    //   } catch (err) {
    //     console.error(err);
    //     res
    //       .status(500)
    //       .send({ success: false, message: "Failed to fetch tuitions" });
    //   }
    // });

    // // ২. এডমিনের জন্য পেন্ডিং তুইশন (শুধু এডমিন দেখতে পাবে)
    // app.get("/tuitions/pending", verifyToken, async (req, res) => {
    //   try {
    //     // এডমিন চেক
    //     const user = await usersCollection.findOne({ email: req.user.email });
    //     if (user?.role !== "admin") {
    //       return res
    //         .status(403)
    //         .send({ success: false, message: "Admin access required" });
    //     }

    //     const tuitions = await tuitionsCollection
    //       .find({ status: "Pending" })
    //       .sort({ postedAt: -1 })
    //       .toArray();

    //     res.send({ success: true, data: tuitions });
    //   } catch (err) {
    //     console.error(err);
    //     res.status(500).send({ success: false, message: "Server error" });
    //   }
    // });

    // // ৩. এপ্রুভ করা
    // app.patch("/tuitions/:id/approve", verifyToken, async (req, res) => {
    //   try {
    //     const user = await usersCollection.findOne({ email: req.user.email });
    //     if (user?.role !== "admin") {
    //       return res
    //         .status(403)
    //         .send({ success: false, message: "Admin only" });
    //     }

    //     const result = await tuitionsCollection.updateOne(
    //       { _id: new ObjectId(req.params.id) },
    //       { $set: { status: "Approved", approvedAt: new Date() } }
    //     );

    //     if (result.modifiedCount === 0) {
    //       return res.status(404).send({ success: false, message: "Not found" });
    //     }

    //     res.send({ success: true, message: "Tuition approved successfully" });
    //   } catch (err) {
    //     res.status(500).send({ success: false, message: "Error approving" });
    //   }
    // });

    // // ৪. রিজেক্ট করা
    // app.patch("/tuitions/:id/reject", verifyToken, async (req, res) => {
    //   try {
    //     const user = await usersCollection.findOne({ email: req.user.email });
    //     if (user?.role !== "admin") {
    //       return res
    //         .status(403)
    //         .send({ success: false, message: "Admin only" });
    //     }

    //     const result = await tuitionsCollection.updateOne(
    //       { _id: new ObjectId(req.params.id) },
    //       { $set: { status: "Rejected" } }
    //     );

    //     if (result.modifiedCount === 0) {
    //       return res.status(404).send({ success: false, message: "Not found" });
    //     }

    //     res.send({ success: true, message: "Tuition rejected" });
    //   } catch (err) {
    //     res.status(500).send({ success: false, message: "Error rejecting" });
    //   }
    // });

    app.get("/tuitions/pending", async (req, res) => {
      try {
        const email = req.query.email; // ফ্রন্টএন্ড থেকে ?email=admin@tutionbazaar.com পাঠাবি

        // এডমিন কিনা চেক করা
        const user = await usersCollection.findOne({ email });
        if (!user || user.role !== "admin") {
          return res
            .status(403)
            .send({ success: false, message: "Admin access required" });
        }

        const tuitions = await tuitionsCollection
          .find({ status: "Pending" })
          .sort({ postedAt: -1 })
          .toArray();

        res.send({ success: true, data: tuitions });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // Approve (JWT ছাড়া)
    app.patch("/tuitions/:id/approve", async (req, res) => {
      try {
        const email = req.body.email; // ফ্রন্টএন্ড থেকে email পাঠাবি
        const user = await usersCollection.findOne({ email });
        if (!user || user.role !== "admin") {
          return res
            .status(403)
            .send({ success: false, message: "Admin only" });
        }

        const result = await tuitionsCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { status: "Approved", approvedAt: new Date() } }
        );

        if (result.modifiedCount === 0) {
          return res.status(404).send({ success: false, message: "Not found" });
        }

        res.send({ success: true, message: "Approved" });
      } catch (err) {
        res.status(500).send({ success: false });
      }
    });

    // Reject (JWT ছাড়া)
    app.patch("/tuitions/:id/reject", async (req, res) => {
      try {
        const email = req.body.email;
        const user = await usersCollection.findOne({ email });
        if (!user || user.role !== "admin") {
          return res
            .status(403)
            .send({ success: false, message: "Admin only" });
        }

        const result = await tuitionsCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { status: "Rejected" } }
        );

        res.send({ success: result.modifiedCount > 0 });
      } catch (err) {
        res.status(500).send({ success: false });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("e-Tuition-BD Backend is running");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
