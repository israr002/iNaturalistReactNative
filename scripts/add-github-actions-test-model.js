// eslint-disable-next-line import/no-extraneous-dependencies
const { DownloaderHelper } = require( "node-downloader-helper" );
const fs = require( "fs" ).promises;
const path = require( "path" );
// eslint-disable-next-line import/no-extraneous-dependencies
const Decompress = require( "decompress" );
require( "dotenv" ).config();

const filename = "small_model.zip";
const modelURL
  = "https://github.com/inaturalist/SeekReactNative/releases/download/v2.9.1-138/small_model.zip";

const modelPath = path.join( __dirname, "..", "temp", "model" );
const androidModelPath = path.join( modelPath, "tf1 2", "small_inception_tf1.tflite" );
const androidTaxonomyPath = path.join( modelPath, "tf1 2", "small_export_tax.csv" );
const iosModelPath = path.join( modelPath, "tf1 2", "small_inception_tf1.mlmodel" );
const iosTaxonomyPath = path.join( modelPath, "tf1 2", "small_export_tax.json" );

const androidDestinationPath = path.join(
  __dirname,
  "..",
  "android",
  "app",
  "src",
  "main",
  "assets",
  "camera"
);
const iosDestinationPath = path.join( __dirname, "..", "ios" );

( async () => {
  console.log( `Downloading example model from '${modelURL}'...` );
  await fs.mkdir( modelPath, { recursive: true } );
  const dl = new DownloaderHelper( modelURL, modelPath );
  dl.on( "end", () => console.log( "Download Completed" ) );
  dl.on( "error", err => console.log( "Download Failed", err ) );
  await dl.start().catch( err => console.error( err ) );
  console.log( "Downloaded!" );

  console.log( "Unzipping!" );
  const zipPath = path.join( modelPath, filename );
  await Decompress( zipPath, modelPath )
    .then( () => {
      console.log( "Done Unzipping!" );
    } )
    .catch( error => console.log( error ) );

  console.log( "Reading output filenames from .env file..." );
  const androidModelFile = process.env.ANDROID_MODEL_FILE_NAME;
  const androidTaxonomyFile = process.env.ANDROID_TAXONOMY_FILE_NAME;
  const iosModelFile = process.env.IOS_MODEL_FILE_NAME;
  const iosTaxonomyFile = process.env.IOS_TAXONOMY_FILE_NAME;
  // TODO: donwload an example Geomodel from the internet
  // NEEDS: https://github.com/inaturalist/iNaturalistMLWork/issues/146
  // const iosGeoModelFile = process.env.IOS_GEOMODEL_FILE_NAME;

  console.log( "Copying model files to assets folder..." );
  await fs.mkdir( androidDestinationPath, { recursive: true } );
  await fs.copyFile(
    androidModelPath,
    path.join( androidDestinationPath, androidModelFile )
  );
  await fs.copyFile(
    androidTaxonomyPath,
    path.join( androidDestinationPath, androidTaxonomyFile )
  );

  await fs.mkdir( iosDestinationPath, { recursive: true } );
  await fs.copyFile(
    iosModelPath,
    path.join( iosDestinationPath, iosModelFile )
  );
  await fs.copyFile(
    iosTaxonomyPath,
    path.join( iosDestinationPath, iosTaxonomyFile )
  );

  console.log( "Delete temp model folder and its contents..." );
  await fs.rm( modelPath, { recursive: true } );

  console.log( "Done!" );
} )();
