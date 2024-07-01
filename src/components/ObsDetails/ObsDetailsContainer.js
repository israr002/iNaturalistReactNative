// @flow
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { createComment } from "api/comments";
import { createIdentification } from "api/identifications";
import { RealmContext } from "providers/contexts";
import type { Node } from "react";
import React, {
  useCallback,
  useEffect,
  useReducer,
  useState
} from "react";
import { Alert, LogBox } from "react-native";
import Observation from "realmModels/Observation";
import safeRealmWrite from "sharedHelpers/safeRealmWrite";
import {
  useAuthenticatedMutation,
  useCurrentUser,
  useIsConnected,
  useLocalObservation,
  useObservationsUpdates,
  useTranslation
} from "sharedHooks";
import useRemoteObservation, {
  fetchRemoteObservationKey
} from "sharedHooks/useRemoteObservation";
import { ACTIVITY_TAB_ID, DETAILS_TAB_ID } from "stores/createLayoutSlice";
import useStore from "stores/useStore";

import useMarkViewedMutation from "./hooks/useMarkViewedMutation";
import ObsDetails from "./ObsDetails";

const { useRealm } = RealmContext;

// this is getting triggered by passing dates, like _created_at, through
// react navigation via the observation object. it doesn't seem to
// actually be breaking anything, for the moment (May 2, 2022)
LogBox.ignoreLogs( [
  "Non-serializable values were found in the navigation state"
] );

const sortItems = ( ids, comments ) => ids.concat( [...comments] ).sort(
  ( a, b ) => ( new Date( a.created_at ) - new Date( b.created_at ) )
);

const initialState = {
  activityItems: [],
  addingActivityItem: false,
  comment: "",
  commentIsOptional: false,
  currentTabId: ACTIVITY_TAB_ID,
  observationShown: null,
  showAgreeWithIdSheet: false,
  showAddCommentSheet: false,
  showSuggestIdSheet: false,
  taxonForAgreement: null
};

const reducer = ( state, action ) => {
  switch ( action.type ) {
    case "SET_INITIAL_OBSERVATION":
      return {
        ...state,
        observationShown: action.observationShown,
        activityItems: sortItems(
          action.observationShown?.identifications || [],
          action.observationShown?.comments || []
        )
      };
    case "ADD_ACTIVITY_ITEM":
      return {
        ...state,
        observationShown: action.observationShown,
        addingActivityItem: false,
        activityItems: sortItems(
          action.observationShown?.identifications || [],
          action.observationShown?.comments || []
        )
      };
    case "LOADING_ACTIVITY_ITEM":
      return {
        ...state,
        addingActivityItem: true
      };
    case "SHOW_AGREE_SHEET":
      return {
        ...state,
        showAgreeWithIdSheet: action.showAgreeWithIdSheet,
        taxonForAgreement: action.taxonForAgreement || state.taxonForAgreement,
        comment: action.comment || state.comment
      };
    case "SHOW_ADD_COMMENT_SHEET":
      return {
        ...state,
        commentIsOptional: action.commentIsOptional,
        showAddCommentSheet: action.showAddCommentSheet
      };
    case "SHOW_SUGGEST_ID_SHEET":
      return {
        ...state,
        showSuggestIdSheet: action.showSuggestIdSheet
      };
    case "SET_COMMENT":
      return {
        ...state,
        comment: action.comment
      };
    default:
      throw new Error( );
  }
};

const ObsDetailsContainer = ( ): Node => {
  const setObservations = useStore( state => state.setObservations );
  const currentTabId = useStore( state => state.currentTabId );
  const setCurrentTabId = useStore( state => state.setCurrentTabId );
  const currentObservation = useStore( state => state.currentObservation );
  const updateObservationKeys = useStore( state => state.updateObservationKeys );
  const currentUser = useCurrentUser( );
  const { params } = useRoute();
  const {
    suggestedTaxonId,
    uuid
  } = params;
  const navigation = useNavigation( );
  const realm = useRealm( );
  const { t } = useTranslation( );
  const isOnline = useIsConnected( );
  const vision = currentObservation?.owners_identification_from_vision;

  const [state, dispatch] = useReducer( reducer, initialState );
  const [remoteObsWasDeleted, setRemoteObsWasDeleted] = useState( false );

  const {
    activityItems,
    addingActivityItem,
    comment,
    commentIsOptional,
    observationShown,
    showAgreeWithIdSheet,
    showAddCommentSheet,
    showSuggestIdSheet,
    taxonForAgreement
  } = state;

  const queryClient = useQueryClient( );

  const localObservation = useLocalObservation( uuid );

  const fetchRemoteObservationEnabled = !!(
    !remoteObsWasDeleted
    && ( !localObservation || localObservation?.wasSynced( ) )
    && isOnline
  );

  const {
    remoteObservation,
    refetchRemoteObservation,
    isRefetching,
    fetchRemoteObservationError
  } = useRemoteObservation( uuid, fetchRemoteObservationEnabled );

  useMarkViewedMutation( localObservation, remoteObservation );

  // If we tried to get a remote observation but it no longer exists, the user
  // can't do anything so we need to send them back and remove the local
  // copy of this observation
  useEffect( ( ) => {
    setRemoteObsWasDeleted( fetchRemoteObservationError?.status === 404 );
  }, [fetchRemoteObservationError?.status] );
  const confirmRemoteObsWasDeleted = useCallback( ( ) => {
    if ( localObservation ) {
      safeRealmWrite( realm, ( ) => {
        localObservation._deleted_at = new Date( );
      }, "adding _deleted_at date in ObsDetailsContainer" );
    }
    if ( navigation.canGoBack( ) ) navigation.goBack( );
  }, [
    localObservation,
    navigation,
    realm
  ] );

  const observation = localObservation || Observation.mapApiToRealm( remoteObservation );
  const hasPhotos = observation?.observationPhotos?.length > 0;

  // In theory the only situation in which an observation would not have a
  // user is when a user is not signed but has made a new observation in the
  // app. Also in theory that user should not be able to get to ObsDetail for
  // those observations, just ObsEdit. But.... let's be safe.
  const belongsToCurrentUser = (
    observation?.user?.id === currentUser?.id
    || ( !observation?.user && !observation?.id )
  );

  const invalidateRemoteObservationFetch = useCallback( ( ) => {
    if ( observation?.uuid ) {
      queryClient.invalidateQueries( {
        queryKey: [fetchRemoteObservationKey, observation.uuid]
      } );
    }
  }, [queryClient, observation?.uuid] );

  useFocusEffect(
    // this ensures activity items load after a user taps suggest id
    // and adds a remote id on the Suggestions screen
    useCallback( ( ) => {
      invalidateRemoteObservationFetch( );
    }, [invalidateRemoteObservationFetch] )
  );

  useEffect( ( ) => {
    if ( !observationShown ) {
      dispatch( {
        type: "SET_INITIAL_OBSERVATION",
        observationShown: observation
      } );
    }
  }, [observation, observationShown] );

  useEffect( ( ) => {
    // if observation does not belong to current user, show
    // new activity items after a refetch
    if ( remoteObservation && !isRefetching ) {
      dispatch( {
        type: "ADD_ACTIVITY_ITEM",
        observationShown: remoteObservation
      } );
    }
  }, [remoteObservation, isRefetching] );

  const tabs = [
    {
      id: ACTIVITY_TAB_ID,
      testID: "ObsDetails.ActivityTab",
      onPress: ( ) => setCurrentTabId( ACTIVITY_TAB_ID ),
      text: t( "ACTIVITY" )
    },
    {
      id: DETAILS_TAB_ID,
      testID: "ObsDetails.DetailsTab",
      onPress: () => setCurrentTabId( DETAILS_TAB_ID ),
      text: t( "DETAILS" )
    }
  ];

  const { refetch: refetchObservationUpdates } = useObservationsUpdates(
    !!currentUser && !!observation
  );

  const showErrorAlert = error => Alert.alert( "Error", error, [{ text: t( "OK" ) }], {
    cancelable: true
  } );

  const openAddCommentSheet = ( { isOptional = false } ) => {
    dispatch( {
      type: "SHOW_ADD_COMMENT_SHEET",
      showAddCommentSheet: true,
      commentIsOptional: isOptional || false
    } );
  };

  const hideAddCommentSheet = ( ) => dispatch( {
    type: "SHOW_ADD_COMMENT_SHEET",
    showAddCommentSheet: false,
    comment: null
  } );

  const createCommentMutation = useAuthenticatedMutation(
    ( commentParams, optsWithAuth ) => createComment( commentParams, optsWithAuth ),
    {
      onSuccess: data => {
        refetchRemoteObservation( );
        if ( belongsToCurrentUser ) {
          safeRealmWrite( realm, ( ) => {
            const localComments = localObservation?.comments;
            const newComment = data[0];
            newComment.user = currentUser;
            localComments.push( newComment );
          }, "setting local comment in ObsDetailsContainer" );
          const updatedLocalObservation = realm.objectForPrimaryKey( "Observation", uuid );
          dispatch( { type: "ADD_ACTIVITY_ITEM", observationShown: updatedLocalObservation } );
        }
      },
      onError: e => {
        let error = null;
        if ( e ) {
          error = t( "Couldnt-create-comment", { error: e.message } );
        } else {
          error = t( "Couldnt-create-comment", { error: t( "Unknown-error" ) } );
        }
        showErrorAlert( error );
      }
    }
  );

  const onCommentAdded = commentBody => {
    dispatch( { type: "LOADING_ACTIVITY_ITEM" } );
    createCommentMutation.mutate( {
      comment: {
        body: commentBody,
        parent_id: uuid,
        parent_type: "Observation"
      }
    } );
  };

  const createIdentificationMutation = useAuthenticatedMutation(
    ( idParams, optsWithAuth ) => createIdentification( idParams, optsWithAuth ),
    {
      onSuccess: data => {
        refetchRemoteObservation( );
        if ( belongsToCurrentUser ) {
          const newIdentification = data[0];
          let newIdentTaxon;
          if ( newIdentification.taxon?.id ) {
            newIdentTaxon = realm?.objectForPrimaryKey( "Taxon", newIdentification.taxon.id );
          }
          newIdentTaxon = newIdentTaxon || newIdentification.taxon;
          safeRealmWrite( realm, ( ) => {
            newIdentification.user = currentUser;
            if ( newIdentTaxon ) newIdentification.taxon = newIdentTaxon;
            if ( vision ) newIdentification.vision = true;
            localObservation?.identifications?.push( newIdentification );
          }, "setting local identification in ObsDetailsContainer" );
          if ( uuid ) {
            const updatedLocalObservation = realm.objectForPrimaryKey( "Observation", uuid );
            dispatch( { type: "ADD_ACTIVITY_ITEM", observationShown: updatedLocalObservation } );
          }
        }
      },
      onError: e => {
        let error = null;
        if ( e ) {
          error = t( "Couldnt-create-identification-error", { error: e.message } );
        } else {
          error = t( "Couldnt-create-identification-unknown-error" );
        }
        showErrorAlert( error );
      }
    }
  );

  const openSuggestIdSheet = useCallback( () => {
    dispatch( { type: "SHOW_SUGGEST_ID_SHEET", showSuggestIdSheet: true } );
  }, [] );

  useEffect( () => {
    if ( !suggestedTaxonId ) return;
    openSuggestIdSheet( );
  }, [openSuggestIdSheet, suggestedTaxonId] );

  const navToSuggestions = ( ) => {
    setObservations( [observation] );
    if ( hasPhotos ) {
      navigation.push( "Suggestions", { lastScreen: "ObsDetails" } );
    } else {
      // Go directly to taxon search in case there are no photos
      navigation.navigate( "TaxonSearch", { lastScreen: "ObsDetails" } );
    }
  };

  const showActivityTab = currentTabId === ACTIVITY_TAB_ID;

  const invalidateQueryAndRefetch = ( ) => {
    invalidateRemoteObservationFetch( );
    refetchRemoteObservation( );
    refetchObservationUpdates( );
  };

  const closeAgreeWithIdSheet = ( ) => {
    dispatch( {
      type: "SHOW_AGREE_SHEET",
      showAgreeWithIdSheet: false,
      taxonForAgreement: null,
      comment: null
    } );
  };

  const onAgree = newComment => {
    const agreeParams = {
      observation_id: observation?.uuid,
      taxon_id: taxonForAgreement?.id,
      body: newComment
    };

    dispatch( { type: "LOADING_ACTIVITY_ITEM" } );
    createIdentificationMutation.mutate( { identification: agreeParams } );
    closeAgreeWithIdSheet( );
  };

  const openAgreeWithIdSheet = taxon => {
    dispatch( { type: "SHOW_AGREE_SHEET", showAgreeWithIdSheet: true, taxonForAgreement: taxon } );
  };

  const suggestIdSheetDiscardChanges = ( ) => {
    dispatch( { type: "SHOW_SUGGEST_ID_SHEET", showSuggestIdSheet: false } );
  };

  const onSuggestId = ( ) => {
    const remark = currentObservation?.description;
    // New taxon identification added by user
    const idParams = {
      observation_id: uuid,
      taxon_id: suggestedTaxonId,
      vision
    };

    if ( remark ) {
      // $FlowIgnore
      idParams.body = remark;
    }

    dispatch( { type: "LOADING_ACTIVITY_ITEM" } );
    createIdentificationMutation.mutate( { identification: idParams } );
  };

  const confirmCommentFromCommentSheet = newComment => {
    if ( !commentIsOptional ) {
      onCommentAdded( newComment );
    } else if ( suggestedTaxonId ) {
      updateObservationKeys( {
        description: newComment
      } );
      openSuggestIdSheet( );
    } else {
      dispatch( { type: "SET_COMMENT", comment: newComment } );
      openAgreeWithIdSheet( taxonForAgreement );
    }
  };

  return observationShown && (
    <ObsDetails
      activityItems={activityItems}
      addingActivityItem={addingActivityItem}
      closeAgreeWithIdSheet={closeAgreeWithIdSheet}
      belongsToCurrentUser={belongsToCurrentUser}
      comment={comment}
      commentIsOptional={commentIsOptional}
      confirmCommentFromCommentSheet={confirmCommentFromCommentSheet}
      confirmRemoteObsWasDeleted={confirmRemoteObsWasDeleted}
      currentTabId={currentTabId}
      currentUser={currentUser}
      hideAddCommentSheet={hideAddCommentSheet}
      isOnline={isOnline}
      isRefetching={isRefetching}
      navToSuggestions={navToSuggestions}
      // saving observation in state (i.e. using observationShown)
      // limits the number of rerenders to entire obs details tree
      observation={observationShown}
      onAgree={onAgree}
      openAgreeWithIdSheet={openAgreeWithIdSheet}
      onSuggestId={onSuggestId}
      openAddCommentSheet={openAddCommentSheet}
      refetchRemoteObservation={invalidateQueryAndRefetch}
      remoteObsWasDeleted={remoteObsWasDeleted}
      showActivityTab={showActivityTab}
      showAgreeWithIdSheet={showAgreeWithIdSheet}
      showAddCommentSheet={showAddCommentSheet}
      showSuggestIdSheet={showSuggestIdSheet}
      suggestIdSheetDiscardChanges={suggestIdSheetDiscardChanges}
      tabs={tabs}
      taxonForAgreement={taxonForAgreement}
    />
  );
};

export default ObsDetailsContainer;
