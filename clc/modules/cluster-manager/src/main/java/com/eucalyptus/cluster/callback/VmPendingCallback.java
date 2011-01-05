package com.eucalyptus.cluster.callback;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;
import org.apache.log4j.Logger;
import com.eucalyptus.cluster.Cluster;
import com.eucalyptus.cluster.Networks;
import com.eucalyptus.cluster.VmInstance;
import com.eucalyptus.cluster.VmInstances;
import com.eucalyptus.cluster.VmTypes;
import com.eucalyptus.entities.VmType;
import com.eucalyptus.util.async.FailedRequestException;
import com.eucalyptus.vm.SystemState;
import com.eucalyptus.vm.SystemState.Reason;
import com.eucalyptus.vm.VmState;
import com.google.common.base.Function;
import com.google.common.collect.Lists;
import edu.ucsb.eucalyptus.cloud.Network;
import edu.ucsb.eucalyptus.cloud.VmDescribeResponseType;
import edu.ucsb.eucalyptus.cloud.VmDescribeType;
import edu.ucsb.eucalyptus.cloud.VmInfo;
import edu.ucsb.eucalyptus.msgs.VmTypeInfo;

public class VmPendingCallback extends StateUpdateMessageCallback<Cluster, VmDescribeType, VmDescribeResponseType> {
  private static Logger LOG = Logger.getLogger( VmPendingCallback.class );
  
  public VmPendingCallback( Cluster cluster ) {
    this.setSubject( cluster );
    this.setRequest( new VmDescribeType( ) {
      {
        regarding( );
        for ( VmInstance vm : VmInstances.getInstance( ).listValues( ) ) {
          if ( vm.getPlacement( ).equals( VmPendingCallback.this.getSubject( ).getName( ) ) ) {
            if ( VmState.PENDING.equals( vm.getState( ) )
                 || vm.getState( ).ordinal( ) > VmState.RUNNING.ordinal( ) ) {
              this.getInstancesSet( ).add( vm.getInstanceId( ) );
            }
          }
        }
      }
    } );
  }
  
  @Override
  public void fire( VmDescribeResponseType reply ) {
    for ( VmInfo runVm : reply.getVms( ) ) {
      runVm.setPlacement( this.getSubject( ).getConfiguration( ).getName( ) );
      VmState state = VmState.Mapper.get( runVm.getStateName( ) );
      VmInstance vm = null;
      try {
        vm = VmInstances.getInstance( ).lookup( runVm.getInstanceId( ) );
        vm.setServiceTag( runVm.getServiceTag( ) );
        if ( VmState.SHUTTING_DOWN.equals( vm.getState( ) ) && vm.getSplitTime( ) > SystemState.SHUT_DOWN_TIME ) {
          vm.setState( VmState.TERMINATED, Reason.EXPIRED );
        } else if ( VmState.SHUTTING_DOWN.equals( vm.getState( ) ) && VmState.SHUTTING_DOWN.equals( state ) ) {
          vm.setState( VmState.TERMINATED, Reason.APPEND, "DONE" );
        } else if ( ( VmState.PENDING.equals( state ) || VmState.RUNNING.equals( state ) )
                    && ( VmState.PENDING.equals( vm.getState( ) ) || VmState.RUNNING.equals( vm.getState( ) ) ) ) {
          if ( !VmInstance.DEFAULT_IP.equals( runVm.getNetParams( ).getIpAddress( ) ) ) {
            vm.updateAddresses( runVm.getNetParams( ).getIpAddress( ), runVm.getNetParams( ).getIgnoredPublicIp( ) );
          }
          vm.setState( VmState.Mapper.get( runVm.getStateName( ) ), Reason.APPEND, "UPDATE" );
          vm.updateNetworkIndex( runVm.getNetParams( ).getNetworkIndex( ) );
          vm.setVolumes( runVm.getVolumes( ) );
        }
      } catch ( NoSuchElementException e ) {
        LOG.debug( "Ignoring update for uncached vm: " + runVm.getInstanceId( ) );
      }
    }
  }
  
  /**
   * @see com.eucalyptus.cluster.callback.StateUpdateMessageCallback#fireException(com.eucalyptus.util.async.FailedRequestException)
   * @param t
   */
  @Override
  public void fireException( FailedRequestException t ) {
    LOG.debug( "Request to " + this.getSubject( ).getName( ) + " failed: " + t.getMessage( ) );
  }
  
}