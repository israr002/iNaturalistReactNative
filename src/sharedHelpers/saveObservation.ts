import type Realm from "realm";
import Observation from "realmModels/Observation";
import { ExifToWrite, writeExifToFile } from "sharedHelpers/parseExif";

const writeExifToCameraRollPhotos = async (
  observation: Observation,
  cameraRollUris: string[],
  exif: ExifToWrite
) => {
  if ( !cameraRollUris || cameraRollUris.length === 0 || !observation ) {
    return;
  }
  // Update all photos taken via the app with the new fetched location.
  cameraRollUris.forEach( uri => {
    writeExifToFile( uri, exif );
  } );
};

const saveObservation = async (
  observation: Observation,
  cameraRollUris: string[],
  realm: Realm
) => {
  await writeExifToCameraRollPhotos( observation, cameraRollUris, {
    latitude: observation.latitude,
    longitude: observation.longitude,
    positional_accuracy: observation.positional_accuracy
  } );
  return Observation.saveLocalObservationForUpload( observation, realm );
};

export default saveObservation;