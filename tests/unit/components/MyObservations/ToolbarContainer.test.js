import { screen } from "@testing-library/react-native";
import * as useDeleteObservations from "components/MyObservations/hooks/useDeleteObservations";
import ToolbarContainer from "components/MyObservations/ToolbarContainer";
import initI18next from "i18n/initI18next";
import i18next from "i18next";
import React from "react";
import { renderComponent } from "tests/helpers/render";

jest.mock( "components/MyObservations/hooks/useDeleteObservations", () => ( {
  __esModule: true,
  default: ( ) => ( {
    currentDeleteCount: 1,
    deletions: [],
    deletionsComplete: false,
    deletionsInProgress: false,
    error: null
  } )
} ) );

const deletionState = {
  currentDeleteCount: 3,
  deletions: [{}, {}, {}],
  deletionsComplete: false,
  deletionsInProgress: false,
  error: null
};

const uploadState = {
  uploadInProgress: false,
  uploads: [{}],
  uploadsComplete: false,
  error: null,
  currentUploadCount: 1
};

describe( "Toolbar", () => {
  beforeAll( async () => {
    await initI18next();
  } );

  it( "displays a pending upload", async () => {
    renderComponent( <ToolbarContainer
      numUnuploadedObs={1}
      uploadState={uploadState}
    /> );

    const statusText = screen.getByText( i18next.t( "Upload-x-observations", { count: 1 } ) );
    expect( statusText ).toBeVisible( );
  } );

  it( "displays an upload in progress", async () => {
    renderComponent( <ToolbarContainer
      numUnuploadedObs={1}
      totalUploadCount={1}
      uploadState={{
        ...uploadState,
        uploadInProgress: true
      }}
    /> );

    const statusText = screen.getByText( i18next.t( "Uploading-x-of-y-observations", {
      total: 1,
      currentUploadCount: 1
    } ) );
    expect( statusText ).toBeVisible( );
  } );

  it( "displays a completed upload", async () => {
    renderComponent( <ToolbarContainer
      progress={1}
      totalUploadCount={1}
      uploadState={{
        ...uploadState,
        uploadsComplete: true
      }}
    /> );

    const statusText = screen.getByText( i18next.t( "X-observations-uploaded", {
      count: 1
    } ) );
    expect( statusText ).toBeVisible( );
  } );

  it( "displays an upload error", async () => {
    const error = "Couldn't complete upload";
    renderComponent( <ToolbarContainer
      uploadState={{
        ...uploadState,
        error
      }}
    /> );
    expect( screen.getByText( error ) ).toBeVisible( );
  } );

  it( "displays multiple pending uploads", async () => {
    renderComponent( <ToolbarContainer
      numUnuploadedObs={4}
      uploadState={{
        ...uploadState,
        uploads: [{}, {}, {}, {}]
      }}
    /> );

    const statusText = screen.getByText( i18next.t( "Upload-x-observations", { count: 4 } ) );
    expect( statusText ).toBeVisible( );
  } );

  it( "displays multiple uploads in progress", async () => {
    renderComponent( <ToolbarContainer
      numUnuploadedObs={3}
      totalUploadCount={5}
      uploadState={{
        ...uploadState,
        uploadInProgress: true,
        uploads: [{}, {}, {}, {}, {}],
        currentUploadCount: 2
      }}
    /> );

    const statusText = screen.getByText( i18next.t( "Uploading-x-of-y-observations", {
      total: 5,
      currentUploadCount: 2
    } ) );
    expect( statusText ).toBeVisible( );
  } );

  it( "displays multiple completed uploads", async () => {
    renderComponent( <ToolbarContainer
      progress={1}
      totalUploadCount={7}
      uploadState={{
        ...uploadState,
        uploads: [{}, {}, {}, {}, {}, {}, {}],
        uploadsComplete: true
      }}
    /> );

    const statusText = screen.getByText( i18next.t( "X-observations-uploaded", {
      count: 7
    } ) );
    expect( statusText ).toBeVisible( );
  } );

  it( "displays deletions in progress", async () => {
    jest.spyOn( useDeleteObservations, "default" ).mockImplementation( ( ) => ( {
      ...deletionState,
      deletionsInProgress: true,
      currentDeleteCount: 2
    } ) );
    renderComponent( <ToolbarContainer uploadState={uploadState} /> );

    const statusText = screen.getByText( i18next.t( "Deleting-x-of-y-observations", {
      total: 3,
      currentDeleteCount: 2
    } ) );
    expect( statusText ).toBeVisible( );
  } );

  it( "displays deletions completed", async () => {
    jest.spyOn( useDeleteObservations, "default" ).mockImplementation( ( ) => ( {
      ...deletionState,
      deletionsComplete: true
    } ) );
    renderComponent( <ToolbarContainer uploadState={uploadState} /> );

    const statusText = screen.getByText( i18next.t( "X-observations-deleted", {
      count: 3
    } ) );
    expect( statusText ).toBeVisible( );
  } );

  it( "displays deletion error", async () => {
    const error = "Unknown problem deleting observations";
    jest.spyOn( useDeleteObservations, "default" ).mockImplementation( ( ) => ( {
      ...deletionState,
      error
    } ) );
    renderComponent( <ToolbarContainer uploadState={uploadState} /> );

    const statusText = screen.getByText( error );
    expect( statusText ).toBeVisible( );
  } );
} );