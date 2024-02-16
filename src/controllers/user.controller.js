import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import uploadOnCloudinary from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";


const genereateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId)
    const refreshToken = user.generateRefreshToken()
    const accessToken = user.generateAccessToken()
    // console.log(refreshToken, accessToken);
    user.refreshToken = refreshToken;
    
    await user.save( {validateBeforeSave : false} ) //it is because the password field kicks in whenever we try to save the changes made in database

    return {accessToken,refreshToken}


  } catch (error) {
    throw new ApiError(500,"Somethig went wrong while generating access and refresh token")
  }
}


const registerUser = asyncHandler( async (req,res) =>{

  /* <----- ALGO FOR REGISTRATION -----> */

  // get user details from frontend
  // validation - not empty
  // check if user already exists: username and email
  // check for images, check for avatar
  // upload them to cloudinary, avatar
  // crate user object - create entry in db
  // remove password and refresh token field from response
  // check for user creation 
  // return res


  /* -----USER DETAILS FROM FRONTEND----- */
  const {fullName, email, username, password} = req.body;
  // console.log("email: " ,email);


  /* -----VALIDATION----- */

  // if (fullName ==="") {
  //   throw new ApiError(400, "FullName is required")
  // }

  if (
    [fullName,email, username, password].some((field) => field?.trim() === "" )
    ) {
    throw new ApiError(400, "All fields are required")
  }

/*----- USER EXISTS OR NOT -----*/
  const existedUser = await User.findOne({
    $or: [{ username },{ email }]
  })

    if (existedUser) {
      throw new ApiError(409, "User with email or username already exists")
    }

/*----- CHECK FOR IMAGES -----*/
    // console.log(req.files);
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) &&req.files.coverImage.length > 0) {
      coverImageLocalPath = req.files.coverImage[0].path
    }

    if (!avatarLocalPath) {
      throw new ApiError(400, "Avatar file is required");
    }

/*----- UPLOAD TO CLOUDINARY -----*/
  const avatar = await uploadOnCloudinary(avatarLocalPath)
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  /*---- DB ENTRY----*/ 
  const user = await User.create({
    fullName,
    avatar : avatar.url,
    coverImage : coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase()
  })

  /*-----REMOVE PWD AND REFRESH TOKEN -----*/
  const createdUser = await User.findOne(user._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new ApiError(500 , "Something went wrong while registering user")
  }

/*---- RETURN RESPONSE -----*/
  return res.status(201).json(
    new ApiResponse(200,createdUser, "User registered successfully")
  )
})

const loginUser = asyncHandler( async(req,res) =>{

  // <----- Algorithms ----->
  // req body -> Data
  // username or email
  // find the user
  // password check
  // access and refresh token
  // send cookies

  // <----- Data from body ---->
  const { email, username, password} = req.body

  // <----- username or email provided or not ----->
  if (!username && !email) {
    throw new ApiError(400,"Username or email is required")
  }

  // <----- check whether user exists or not ----->
  const user = await User.findOne({
    $or: [{username},{email}]
  })

  if (!user) {
    throw new ApiError(404,"User doesnot not exist")
  }

  // <----- check whether pwd is correct or not ----->
  const isPasswordValid = await user.isPasswordCorrect(password)

  if (!isPasswordValid) {
    throw new ApiError(401,"Invalid user credentials")
  }

  // <----- access or referesh token ---->
  const {accessToken,refreshToken} = await genereateAccessAndRefreshToken(user._id)
  console.log(accessToken,refreshToken);

  // either update the object or make one database query call / the option should be chosen based on the requirement and cost 
  const loggedInUser = await User.findOne(user._id).select("-password -refreshToken")
  // console.log(loggedInUser);

  //<----- send cookie ---->
  const options ={
    httpOnly: true,
    secure: true
  } // can only be modified by the server not the frontend

  return res
  .status(200)
  .cookie("accessToken",accessToken,options)
  .cookie("refreshToken",refreshToken,options)
  .json(
    new ApiResponse(
      200,
      {
        user: loggedInUser, accessToken,refreshToken
      },
      "User logged in successfully"
    )
  )
} )

const logoutUser = asyncHandler(async (req, res) => {
  // clear cookie and refresh token
  await User.findByIdAndUpdate(
    // access the user through auth middleware
    req.user._id,  //ethi heichi khela
    {
      $set: {
        refreshToken:undefined,
      }
    },
    {
      new: true
    }
    )

    const options ={
      httpOnly: true,
      secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200, {}, "User Logged Out"))
})

export {
  registerUser,
  loginUser,
  logoutUser
}