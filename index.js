const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// const stripe = require("stripe")(process.env.STRIPE_SECRET);
const stripe = require("stripe")(process.env.STRIPE_SECRET);

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
    const applicationColl = db.collection("applications");
    const userColl = db.collection("users");
    const paymentColl = db.collection("payments");

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

    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userColl.findOne(query);
      res.send({ role: user?.role || "user" });
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
    // remove admin
    app.patch("/users/:id/remove-admin", async (req, res) => {
      const { id } = req.params;
      const result = await userColl.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: "user" } }
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

    // update

    app.put("/tuitions/:id", async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;
      try {
        const result = await tuitionsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Tuition not found" });
        }
        res.send({ success: true, modifiedCount: result.modifiedCount });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error", error: err.message });
      }
    });

    // DELETE a tuition by ID
    app.delete("/tuitions/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ success: false, message: "Invalid ID" });
        }
        const result = await tuitionsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 0) {
          return res
            .status(404)
            .send({ success: false, message: "Tutor not found" });
        }
        res.send({ success: true, deletedCount: result.deletedCount });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // Approve
    app.patch("/tuitions/:id/approve", async (req, res) => {
      const { id } = req.params;
      const { email } = req.body;
      const user = await userColl.findOne({ email });
      if (!user || user.role !== "admin")
        return res.status(403).send({ success: false, message: "Admin only" });

      const result = await tuitionsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "Approved", approvedAt: new Date() } }
      );

      res.send({ success: result.modifiedCount > 0 });
    });

    // Reject
    app.patch("/tuitions/:id/reject", async (req, res) => {
      const { id } = req.params;
      const { email } = req.body;
      const user = await userColl.findOne({ email });
      if (!user || user.role !== "admin")
        return res.status(403).send({ success: false, message: "Admin only" });

      const result = await tuitionsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "Rejected" } }
      );

      res.send({ success: result.modifiedCount > 0 });
    });

    // email get

    app.get("/tuitions-get", async (req, res) => {
      const { email } = req.query;
      let query = {};
      if (email) {
        query.studentEmail = email;
      }
      const result = await tuitionsCollection
        .find(query)
        .sort({ postedAt: -1 })
        .toArray();
      res.send(result);
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

    // tutor profiles
    app.get("/tutors", async (req, res) => {
      const tutors = await tutorsCollection
        .find()
        .sort({ postedAt: -1 })
        .toArray();
      res.send(tutors);
    });

    // DELETE a tutor by ID
    app.delete("/tutors/:id", async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ success: false, message: "Invalid ID" });
        }
        const result = await tutorsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 0) {
          return res
            .status(404)
            .send({ success: false, message: "Tutor not found" });
        }
        res.send({ success: true, deletedCount: result.deletedCount });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // payment api

    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      const amount = parseInt(paymentInfo.expectedSalary) * 100;

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            // Provide the exact Price ID (for example, price_1234) of the product you want to sell
            price_data: {
              currency: "USD",
              unit_amount: amount,
              product_data: {
                name: paymentInfo.tutorName,
              },
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        customer_email: paymentInfo.tutorEmail,
        metadata: {
          tutorId: paymentInfo.tutorId,
        },
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-history`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-history`,
      });
      console.log(session);
      res.send({ url: session.url });
    });

    // tutor update

    app.put("/tutors/:id", async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;
      try {
        const result = await tutorsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Tutor not found" });
        }
        res.send({ success: true, modifiedCount: result.modifiedCount });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error", error: err.message });
      }
    });

    // Approve
    app.patch("/tutor/:id/approve", async (req, res) => {
      const { id } = req.params;
      const { email } = req.body;
      const user = await userColl.findOne({ email });
      if (!user || user.role !== "admin")
        return res.status(403).send({ success: false, message: "Admin only" });

      const result = await tutorsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "Approved", approvedAt: new Date() } }
      );

      res.send({ success: result.modifiedCount > 0 });
    });

    // Reject
    app.patch("/tutor/:id/reject", async (req, res) => {
      const { id } = req.params;
      const { email } = req.body;
      const user = await userColl.findOne({ email });
      if (!user || user.role !== "admin")
        return res.status(403).send({ success: false, message: "Admin only" });

      const result = await tutorsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "Rejected" } }
      );

      res.send({ success: result.modifiedCount > 0 });
    });

    // // my application

    // app.get("/application", async (req, res) => {
    //   try {
    //     const email = req.query.email;

    //     // শুধু নিজে এর ডেটা fetch করবে
    //     if (!email || email !== req.decoded_email) {
    //       return res.status(403).send({ message: "Forbidden access" });
    //     }

    //     const applications = await tutorsCollection
    //       .find({ email })
    //       .sort({ createdAt: -1 })
    //       .toArray();

    //     res.send(applications);
    //   } catch (err) {
    //     console.error(err);
    //     res.status(500).send({ message: "Server error", error: err.message });
    //   }
    // });

    // email get

    app.get("/applications", async (req, res) => {
      const { email } = req.query;
      let query = {};
      if (email) {
        query.tutorEmail = email;
      }
      const result = await tutorsCollection
        .find(query)
        .sort({ postedAt: -1 })
        .toArray();
      res.send(result);
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
