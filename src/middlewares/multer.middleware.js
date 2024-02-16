import multer from "multer";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp")
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
    // file.originalname should be avoided to increase consistency because same name file can be uploaded multiple times
  }
})

export const upload = multer({
  storage, 
})