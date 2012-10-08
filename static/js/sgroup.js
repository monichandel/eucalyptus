/*************************************************************************
 * Copyright 2009-2012 Eucalyptus Systems, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see http://www.gnu.org/licenses/.
 *
 * Please contact Eucalyptus Systems, Inc., 6755 Hollister Ave., Goleta
 * CA 93117, USA or visit http://www.eucalyptus.com/licenses/ if you need
 * additional information or have any questions.
 ************************************************************************/

(function($, eucalyptus) {
  $.widget('eucalyptus.sgroup', $.eucalyptus.eucawidget, {
    options : { },
    baseTable : null,
    tableWrapper : null,
    delDialog : null,
    addDialog : null,
    editDialog : null,
    rulesList : null,
    _init : function() {
      var thisObj = this;
      var $tmpl = $('html body').find('.templates #sgroupTblTmpl').clone();
      var $wrapper = $($tmpl.render($.extend($.i18n.map, help_sgroup)));
      var $sgroupTable = $wrapper.children().first();
      var $sgroupHelp = $wrapper.children().last();
      this.baseTable = $sgroupTable;
      this.tableWrapper = $sgroupTable.eucatable({
        id : 'sgroups', // user of this widget should customize these options,
        dt_arg : {
          "sAjaxSource": "../ec2?Action=DescribeSecurityGroups&_xsrf="+$.cookie('_xsrf'),
          "aoColumns": [
            {
              "bSortable": false,
              "fnRender": function(oObj) { return '<input type="checkbox"/>' },
              "sClass": "checkbox-cell",
            },
            { 
              "fnRender" : function(oObj) { 
                 return $('<div>').append($('<a>').attr('href','#').addClass('twist').text(oObj.aData.name)).html();
              }
            },
            { "mDataProp": "description" },
         /*   {
              "bSortable": false,
              "fnRender": function(oObj) { return '<a href="#">Show rules</a>' },
              "sWidth": "200px",
              "sClass": "table_center_cell",
            }*/
          ],
        },
        text : {
          header_title : sgroup_h_title,
          create_resource : sgroup_create,
          resource_found : 'sgroup_found',
          resource_search : sgroup_search,
          resource_plural : sgroup_plural,
        },
        menu_actions : function(){
          return{"edit": {"name": sgroup_action_edit, callback: function(key, opt) { thisObj._editAction();}},
                 "delete" : { "name": sgroup_action_delete, callback: function(key, opt) { thisObj._deleteAction();}}};
        },
        context_menu_actions : function(state) { 
          return{"edit": {"name": sgroup_action_edit, callback: function(key, opt) { thisObj._editAction();}},
                 "delete" : { "name": sgroup_action_delete, callback: function(key, opt) { thisObj._deleteAction();}}};
        },
        expand_callback : function(row){ // row = [col1, col2, ..., etc]
          return thisObj._expandCallback(row);
        },
        menu_click_create : function (args) { thisObj._createAction(); },
        help_click : function(evt) {
          thisObj._flipToHelp(evt, $sgroupHelp);
        },
      });
      this.tableWrapper.appendTo(this.element);
    },

    _create : function() {
      var thisObj = this;
      $("#sgroups-selector").change( function() { thisObj.reDrawTable() } );

      var $tmpl = $('html body').find('.templates #sgroupDelDlgTmpl').clone();
      var $rendered = $($tmpl.render($.extend($.i18n.map, help_sgroup)));
      var $del_dialog = $rendered.children().first();
      var $del_help = $rendered.children().last();

      this.delDialog = $del_dialog.eucadialog({
         id: 'sgroups-delete',
         title: sgroup_dialog_del_title,
         buttons: {
           'delete': {text: sgroup_dialog_del_btn, click: function() { thisObj._deleteSelectedSecurityGroups(); $del_dialog.eucadialog("close");}},
           'cancel': {text: dialog_cancel_btn, focus:true, click: function() { $del_dialog.eucadialog("close");}} 
         },
         help: { content: $del_help },
       });

      var createButtonId = 'sgroup-add-btn';
      var $tmpl = $('html body').find('.templates #sgroupAddDlgTmpl').clone();
      var $rendered = $($tmpl.render($.extend($.i18n.map, help_sgroup)));
      var $add_dialog = $rendered.children().first();
      var $add_help = $rendered.children().last();

      this.addDialog = $add_dialog.eucadialog({
        id: 'sgroups-add',
        title: sgroup_dialog_add_title,
        buttons: { 
        'create': { domid: createButtonId, text: sgroup_dialog_create_btn, disabled: true,  click: function() {
              var name = $.trim($add_dialog.find('#sgroup-name').val());
              var desc = $.trim($add_dialog.find('#sgroup-description').val());
              thisObj._storeRule(thisObj.addDialog);    // flush rule from form into array
              var fromPort = new Array();
              var toPort = new Array();
              var protocol = new Array();
              var cidr = new Array();
              var fromGroup = new Array();
              for (rule in thisObj.rulesList){
                  if (thisObj.rulesList[rule].isnew == true) {
                      fromPort.push(thisObj.rulesList[rule].from_port);
                      toPort.push(thisObj.rulesList[rule].to_port);
                      protocol.push(thisObj.rulesList[rule].protocol);
                      cidr.push(thisObj.rulesList[rule].ipaddr);
                      fromGroup.push(thisObj.rulesList[rule].fromGroup);
                  }
              }
              $add_dialog.eucadialog("close");
              $.ajax({
                  type:"GET",
                  url:"/ec2?Action=CreateSecurityGroup",
                  data:"_xsrf="+$.cookie('_xsrf') + "&GroupName=" + name + "&GroupDescription=" + desc,
                  dataType:"json",
                  async:"false",
                  success: function (data, textstatus, jqXHR) {
                      if (data.results && data.results.status == true) {
                          if (fromPort.length > 0) {
                              notifySuccess(null, $.i18n.prop('sgroup_create_success', name));
                              thisObj._addIngressRule($add_dialog, name, fromPort, toPort, protocol, cidr, fromGroup);
                              thisObj._getTableWrapper().eucatable('refreshTable');
//                              $add_dialog.eucadialog("close");
                          }
                          else {
                              notifySuccess(null, $.i18n.prop('sgroup_create_success', name));
                              thisObj._getTableWrapper().eucatable('refreshTable');
                              thisObj._getTableWrapper().eucatable('glowRow', name);
//                              $add_dialog.eucadialog("close");
                          }
                      } else {
//                          $add_dialog.eucadialog("close");
                          notifyError($.i18n.prop('sgroup_add_rule_error', name), getErrorMessage(jqXHR));
                      }
                  },
                  error: function (jqXHR, textStatus, errorThrown) {
//                    $add_dialog.eucadialog("close");
                    notifyError($.i18n.prop('sgroup_create_error', name), getErrorMessage(jqXHR));
                  }
              });
            }},
        'cancel': {text: dialog_cancel_btn, focus:true, click: function() { $add_dialog.eucadialog("close");}},
        },
        help: { content: $add_help },
        user_val : function(index) {
                    thisObj.rulesList.splice(index, 1);
                    thisObj._refreshRulesList(thisObj.addDialog);
        },
      });

      var group_ids = [];
      var results = describe('sgroup');
      if ( results ) {
        for( res in results) {
          var group = results[res];
          group_ids.push(group.name);
        }
      }
      this._setupDialogFeatures(this.addDialog, group_ids, createButtonId);

      var $tmpl = $('html body').find('.templates #sgroupEditDlgTmpl').clone();
      var $rendered = $($tmpl.render($.extend($.i18n.map, help_sgroup)));
      var $edit_dialog = $rendered.children().first();
      var $edit_help = $rendered.children().last();
      this.editDialog = $edit_dialog.eucadialog({
        id: 'sgroups-edit',
        title: sgroup_dialog_edit_title,
        buttons: { 
        'save': { domid: createButtonId, text: sgroup_dialog_save_btn, click: function() {
              thisObj._storeRule(thisObj.editDialog);    // flush rule from form into array
              // need to remove rules flagged for deletion, then add new ones to avoid conflicts
              $edit_dialog.eucadialog("close");
              var name = thisObj.editDialog.find('#sgroups-hidden-name').html();
              var fromPort = new Array();
              var toPort = new Array();
              var protocol = new Array();
              var cidr = new Array();
              var fromGroup = new Array();
              for (rule in thisObj.rulesList){
                  if (thisObj.rulesList[rule].deletethis == true) {
                      fromPort.push(thisObj.rulesList[rule].from_port);
                      toPort.push(thisObj.rulesList[rule].to_port);
                      protocol.push(thisObj.rulesList[rule].protocol);
                      cidr.push(thisObj.rulesList[rule].ipaddr);
                      fromGroup.push(thisObj.rulesList[rule].fromGroup);
                  }
              }
              if (fromPort.length > 0) {
                  
                  thisObj._removeIngressRule($edit_dialog, name, fromPort, toPort, protocol, cidr, fromGroup);
              }
              var fromPort = new Array();
              var toPort = new Array();
              var protocol = new Array();
              var cidr = new Array();
              var fromGroup = new Array();
              for (rule in thisObj.rulesList){
                  if (thisObj.rulesList[rule].isnew == true) {
                      fromPort.push(thisObj.rulesList[rule].from_port);
                      toPort.push(thisObj.rulesList[rule].to_port);
                      protocol.push(thisObj.rulesList[rule].protocol);
                      cidr.push(thisObj.rulesList[rule].ipaddr);
                      fromGroup.push(thisObj.rulesList[rule].fromGroup);
                  }
              }
              if (fromPort.length > 0) {
                  thisObj._addIngressRule($edit_dialog, name, fromPort, toPort, protocol, cidr, fromGroup);
              }
              thisObj._getTableWrapper().eucatable('refreshTable');
            }},
        'cancel': {text: dialog_cancel_btn, focus:true, click: function() { $edit_dialog.eucadialog("close");}},
        },
        help: { content: $edit_help },
        user_val : function(index) {
                    if (thisObj.rulesList[index].isnew) {
                        thisObj.rulesList.splice(index, 1);
                    }
                    else {
                        thisObj.rulesList[index].deletethis = true;
                    }
                    thisObj._refreshRulesList(thisObj.editDialog);
        },
      });
      this._setupDialogFeatures(this.editDialog, group_ids, createButtonId);
    },

    _destroy : function() {
    },

    _setupDialogFeatures : function(dialog, group_ids, createButtonId) {
      var thisDialog = dialog;
      var thisObj = this;
      var groupSelector = dialog.find('#allow-group');
      groupSelector.autocomplete({
        source: group_ids,
        select: function() {
        }
      });
      groupSelector.watermark(sgroup_group_name);
      dialog.eucadialog('buttonOnKeyup', dialog.find('#sgroup-name'), createButtonId, function () {
         thisObj._validateFormAdd(createButtonId, thisDialog);
      });
      dialog.eucadialog('buttonOnKeyup', dialog.find('#sgroup-description'), createButtonId, function () {
         thisObj._validateFormAdd(createButtonId, thisDialog);
      });
      dialog.eucadialog('buttonOnKeyup', dialog.find('#sgroup-template'), createButtonId, function () {
         thisObj._validateForm(createButtonId, thisDialog);
      });
      dialog.eucadialog('buttonOnKeyup', dialog.find('#sgroup-ports'), createButtonId, function () {
         thisObj._validateFormAdd(createButtonId, thisDialog);
      });
      dialog.eucadialog('buttonOnKeyup', dialog.find('#sgroup-type'), createButtonId, function () {
         thisObj._validateFormAdd(createButtonId, thisDialog);
      });
      dialog.eucadialog('onChange', 'sgroup-template', 'unused', function () {
         var thediv = dialog.find('#sgroup-more-rules');
         var sel = dialog.find('#sgroup-template');
         var templ = sel.val();
         if (templ == 'none') {
            thediv.css('display','none')
            thisDialog.find('#sgroup-ports').val('');
         }
         else {
            thediv.css('display','block')
            if (templ.indexOf('Custom', 0) == -1) {
                var idx = templ.indexOf('port', 0);
                var part = templ.substr(idx+5);
                thisDialog.find('#sgroup-ports').val(parseInt(part));
            }
            else
                thisDialog.find('#sgroup-ports').val('');
            if (templ.indexOf('TCP') > -1)
                thisObj._setPortOption(thisDialog);
            else {
                if (templ.indexOf('UDP') > -1)
                    thisObj._setPortOption(thisDialog);
                else {
                    if (templ.indexOf('ICMP') > -1) {
                        thisObj._setTypeOption(thisDialog);
                    }
                }
            }
         }
      });
      dialog.find('#sgroup-allow-ip').change(function () {
        thisDialog.find('#allow-ip').prop('disabled', false);
        thisDialog.find('#sgroup-ip-check').prop('disabled', false);
        thisDialog.find('#allow-group').prop('disabled', true);
      });
      dialog.find('#sgroup-allow-group').change(function () {
        thisDialog.find('#allow-ip').prop('disabled', true);
        thisDialog.find('#sgroup-ip-check').prop('disabled', true);
        thisDialog.find('#allow-group').prop('disabled', false);
      });
      dialog.find('#allow-ip').keyup(function () {
        var val = thisDialog.find('#allow-ip').val();
        if (val.match('^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])/([1-9]|[1-3][0-9])$') != null)
            thisDialog.find('#allow-ip-error').html("");
        else
            thisDialog.find('#allow-ip-error').html(sgroup_error_address_range);
      });
      dialog.find('#sgroup-ports').keyup(function () {
        var template = thisDialog.find('#sgroup-template').val();
        if (template.indexOf('TCP') > -1 || template.indexOf('UDP') > -1) {
          if (ports == '') {
            thisDialog.find('#sgroup-ports-error').html(sgroup_error_port);
            enable = false;
          }
          else {
            // try parsing values to integers
            var port_list = ports.split('-');
            from_port = ports[0];
            if (from_port != parseInt(from_port)) {
              thisDialog.find('#sgroup-ports-error').html(sgroup_error_from_port);
              enable = false;
            }
            else if (ports.length > 1 && ports[1] != parseInt(ports[1])) {
              thisDialog.find('#sgroup-ports-error').html(sgroup_error_to_port);
              enable = false;
            }
          }
        }
      });
      dialog.find('#sgroup-ip-check').click(function () {
        $.ajax({
            type: 'GET',
            url: '/checkip',
            contentType: 'text/plain; charset=utf-8',
            dataType: "text",
            success: function(data, textStatus, jqXHR) {
                         thisDialog.find('#allow-ip').val(jqXHR.responseText+"/32")
                     }
        });
      });
      dialog.find('#sgroup-add-rule').click(function () {
        thisObj._storeRule(thisDialog);
        // now reset form
        thisDialog.find('#sgroup-template').val('none');
        thisDialog.find('#sgroup-ports').val('');
        thisDialog.find('#allow-ip').val('');
        thisDialog.find('#allow-group').val('');
        thisObj._refreshRulesList(thisDialog);
      });
    },

    _validateFormAdd : function(createButtonId, dialog) {
      name = $.trim(dialog.find('#sgroup-name').val());
      desc = $.trim(dialog.find('#sgroup-description').val());
      $button = dialog.parent().find('#' + createButtonId);
      if ( name.length == 0 || desc.length == 0 )     
        $button.prop("disabled", false).addClass("ui-state-disabled");
      else {
        $button.prop("disabled", false).removeClass("ui-state-disabled");
        this._validateForm(createButtonId, dialog);
      }
    },

    _validateForm : function(createButtonId, dialog) {
      var enable = true;
      $button = dialog.parent().find('#' + createButtonId);

      template = dialog.find('#sgroup-template').val();
      ports = dialog.find('#sgroup-ports').val();
      type = dialog.find('#sgroup-type').val();
      allow_ip = dialog.find('#allow-ip').val();
      allow_group = dialog.find('#allow-group').val();
      dialog.find('#sgroup-ports-error').html("");
      if (template.indexOf('TCP') > -1 || template.indexOf('UDP') > -1) {
        if (ports == '') {
          enable = false;
        }
        else {
          // try parsing values to integers
          var port_list = ports.split('-');
          from_port = ports[0];
          if (from_port != parseInt(from_port)) {
            enable = false;
          }
          else if (ports.length > 1 && ports[1] != parseInt(ports[1])) {
            enable = false;
          }
        }
      }
      else if (template.indexOf('ICMP') > -1) {
        if (type == '')
          enable = false;
        else if (type != parseInt(type)) {
          enable = false;
        }
      }

      if (template != 'none') {
          if (dialog.find("input[@name='allow-group']:checked").val() == 'ip') {
            if (dialog.find('#allow-ip').val() == '')
                enable = false;
          }
          else if (dialog.find("input[@name='allow-group']:checked").val() == 'group') {
            if (dialog.find('#allow-group').val() == '')
                enable = false;
          }
      }

      if (enable == true) {
        $button.prop("disabled", false).removeClass("ui-state-disabled");
        dialog.find("#sgroup-add-rule").removeClass("ui-state-disabled");
      }
      else {
        $button.prop("disabled", false).addClass("ui-state-disabled");
        dialog.find("#sgroup-add-rule").addClass("ui-state-disabled");
      }
    },

    _setPortOption : function(dialog) {
        dialog.find('#sgroup-port-option').css('display','block')
        dialog.find('#sgroup-type-option').css('display','none')
    },

    _setTypeOption : function(dialog) {
        dialog.find('#sgroup-port-option').css('display','none')
        dialog.find('#sgroup-type-option').css('display','block')
    },

    // this function is used to take an ingress rule from the form and move it to the rulesList
    _storeRule : function(dialog) {
        if (this.rulesList == null) {
            this.rulesList = new Array();
        }
        // if nothing selected, don't save
        template = dialog.find('#sgroup-template').val();
        if (template == 'none')
            return;
        var rule = new Object();
        if (template.indexOf('TCP') > -1)
            rule.protocol = 'tcp';
        else {
            if (template.indexOf('UDP') > -1)
                rule.protocol = 'udp';
            else {
                if (template.indexOf('ICMP') > -1)
                    rule.protocol = 'icmp';
            }
        }
        if (rule.protocol == 'icmp') {
            var icmp_type = dialog.find('#sgroup-type').val();
            rule.from_port = icmp_type;
            rule.to_port = icmp_type;
        }
        else { // gather port details
            var port_range = dialog.find('#sgroup-ports').val();
            // if no port named, don't save
            if (port_range == '')
                return;
            var ports = port_range.split('-');
            rule.from_port = ports[0];
            rule.to_port = ports[ports.length-1];
        }
        if (dialog.find("input[@name=allow-group]:checked").attr('id') == 'sgroup-allow-ip') {
            rule.ipaddr = dialog.find('#allow-ip').val();
        }
        else if (dialog.find("input[@name=allow-group]:checked").attr('id') == 'sgroup-allow-group') {
            rule.group = dialog.find('#allow-group').val();
        }
        rule.isnew = true;
        this.rulesList.push(rule);
    },

    // this function populates the div where rules are listed based on the rulesList
    _refreshRulesList : function(dialog) {
        if (this.rulesList != null) {
            var msg = "<ul class='sg-rules-list'>";
            var i=0;
            for (rule in this.rulesList) {
                if (this.rulesList[rule].deletethis == true) continue;
                var ports = this.rulesList[rule].from_port;
                if (this.rulesList[rule].from_port != this.rulesList[rule].to_port) {
                    ports += "-"+this.rulesList[rule].to_port;
                }
                msg += "<li><a href='#' id='sgroup-rule-number-"+i+"'>"+delete_label+"</a>"+rule_label+"&nbsp;"+this.rulesList[rule].protocol+
                            " ("+ ports+"), "+
                            this.rulesList[rule].ipaddr+"</li>";
                i += 1;
            }
            msg += "</ul>";
            dialog.find('#sgroup-rules-list').html(msg);
            i=0;
            for (rule in this.rulesList) {
                if (this.rulesList[rule].deletethis == true) continue;
                dialog.find('#sgroup-rule-number-'+i).on('click', {index: i, source: dialog}, function(event) {
                      event.data.source.dialog('option', 'user_val')(event.data.index);
                });
                i += 1;
            }
        }
    },

    // this function takes rules returned from an API call and populates the rulesList
    _fillRulesList : function(groupRecord) {
        this.rulesList = new Array();
        rules = groupRecord.rules;
        for (i=0; i<rules.length; i++) {
            var rule = new Object();
            rule.protocol = rules[i].ip_protocol;
            rule.from_port = rules[i].from_port;
            rule.to_port = rules[i].to_port;
            if (rules[i].grants[0].cidr_ip != '')
                rule.ipaddr = rules[i].grants[0].cidr_ip;
            if (rules[i].grants[0].group_id != '')
                rule.group = rules[i].grants[0].group_id;
            this.rulesList.push(rule);
        }
    },

    _getGroupName : function(rowSelector) {
      return $(rowSelector).find('td:eq(1)').text();
    },

    _reDrawTable : function() {
      this.tableWrapper.eucatable('reDrawTable');
    },

    _deleteSelectedSecurityGroups : function () {
      var thisObj = this;
      var rowsToDelete = thisObj._getTableWrapper().eucatable('getSelectedRows', 1);
      for ( i = 0; i<rowsToDelete.length; i++ ) {
        var sgroupName = $(rowsToDelete[i]).html();
        $.ajax({
          type:"GET",
          url:"/ec2?Action=DeleteSecurityGroup&GroupName=" + sgroupName,
          data:"_xsrf="+$.cookie('_xsrf'),
          dataType:"json",
          async:"true",
          success:
          (function(sgroupName) {
            return function(data, textStatus, jqXHR){
              if ( data.results && data.results == true ) {
                notifySuccess(null, $.i18n.prop('sgroup_delete_success', sgroupName));
                thisObj._getTableWrapper().eucatable('refreshTable');
              } else {
                notifyError($.i18n.prop('sgroup_delete_error', sgroupName), undefined_error);
              }
           }
          })(sgroupName),
          error:
          (function(sgroupName) {
            return function(jqXHR, textStatus, errorThrown){
              thisObj.delDialog.eucadialog('showError', $.i18n.prop('sgroup_delete_error', sgroupName));
            }
          })(sgroupName)
        });
      }
    },

    _addIngressRule : function(dialog, groupName, fromPort, toPort, protocol, cidr, fromGroup) {
      var thisObj = this;
      var req_params = "&GroupName=" + groupName;
      for (i=0; i<fromPort.length; i++) {
          req_params += "&IpPermissions."+(i+1)+".IpProtocol=" + protocol[i];
          req_params += "&IpPermissions."+(i+1)+".FromPort=" + fromPort[i];
          req_params += "&IpPermissions."+(i+1)+".ToPort=" + toPort[i];
          if (cidr[i])
              req_params += "&IpPermissions."+(i+1)+".IpRanges.1.CidrIp=" + cidr[i];
          if (fromGroup[i])
              req_params += "&IpPermissions."+(i+1)+".Groups.1.Groupname=" + fromGroup[i];
      }
      var sgroupName = groupName;
      dialog.eucadialog("close");
      $.ajax({
        type:"GET",
        url:"/ec2?Action=AuthorizeSecurityGroupIngress",
        data:"_xsrf="+$.cookie('_xsrf') + req_params,
        dataType:"json",
        async:"false",
        success: (function(sgroupName) {
            return function(data, textStatus, jqXHR){
                notifySuccess(null, $.i18n.prop('sgroup_add_rule_success', sgroupName));
//                dialog.eucadialog("close");
            }
        }),
        error: (function(sgroupName) {
            return function(jqXHR, textStatus, errorThrown){
                notifyError($.i18n.prop('sgroup_add_rule_error', sgroupName), getErrorMessage(jqXHR));
//                dialog.eucadialog("close");
            }
        }),
      });
    },

    _removeIngressRule : function(dialog, groupName, fromPort, toPort, protocol, cidr, fromGroup) {
      var thisObj = this;
      var req_params = "&GroupName=" + groupName;
      for (i=0; i<fromPort.length; i++) {
          req_params += "&IpPermissions."+(i+1)+".IpProtocol=" + protocol[i];
          req_params += "&IpPermissions."+(i+1)+".FromPort=" + fromPort[i];
          req_params += "&IpPermissions."+(i+1)+".ToPort=" + toPort[i];
          if (cidr[i])
              req_params += "&IpPermissions."+(i+1)+".IpRanges.1.CidrIp=" + cidr[i];
          if (fromGroup[i])
              req_params += "&IpPermissions."+(i+1)+".Groups.1.Groupname=" + fromGroup[i];
      }
      var sgroupName = groupName;
      $.ajax({
        type:"GET",
        url:"/ec2?Action=RevokeSecurityGroupIngress",
        data:"_xsrf="+$.cookie('_xsrf') + req_params,
        dataType:"json",
        async:"false",
        success: (function(sgroupName) {
            return function(data, textStatus, jqXHR){
                notifySuccess(null, $.i18n.prop('sgroup_revoke_rule_success', sgroupName));
//                dialog.eucadialog("close");
            }
        }),
        error: (function(sgroupName) {
            return function(jqXHR, textStatus, errorThrown){
                notifyError($.i18n.prop('sgroup_revoke_rule_error', sgroupName), getErrorMessage(jqXHR));
//                dialog.eucadialog("close");
            }
        }),
      });
    },

    _getTableWrapper : function() {
      return this.tableWrapper;
    },

    _deleteAction : function() {
      var thisObj = this;
      var $tableWrapper = this._getTableWrapper();
      rowsToDelete = $tableWrapper.eucatable('getSelectedRows', 1);
      var matrix = [];
      $.each(rowsToDelete,function(idx, group){
        group = $(group).html();
        matrix.push([group]);
      });

      if ( rowsToDelete.length > 0 ) {
        thisObj.delDialog.eucadialog('setSelectedResources', {title:[sgroup_dialog_del_resource_title], contents: matrix});
        thisObj.delDialog.dialog('open');
      }
    },

    _createAction : function() {
      var thisObj = this;
      thisObj.rulesList=null;
      $('#sgroup-rules-list').html('');
      thisObj.addDialog.eucadialog('open');
      thisObj.addDialog.find('input[id=sgroup-name]').focus();
      thisObj.addDialog.find('input[id=sgroup-description]').focus();
      thisObj.addDialog.find('#sgroup-template').val('none');
      thisObj.addDialog.find('input[id=allow-ip]').prop('disabled', false);
      thisObj.addDialog.find('input[id=allow-group]').prop('disabled', true);
      thisObj.addDialog.find('input[id=sgroup-allow-ip]').prop('checked', 'yes');
      thisObj.addDialog.find('#sgroup-more-rules').css('display','none')
    },

    _editAction : function() {
      var thisObj = this;
      var $tableWrapper = this._getTableWrapper();
      rowsToEdit = $tableWrapper.eucatable('getSelectedRows');
      firstRow = rowsToEdit[0];
      thisObj._fillRulesList(firstRow);
      thisObj.editDialog.dialog('open');
      thisObj.editDialog.find('#sgroups-edit-group-name').html(firstRow.name+" "+sgroup_dialog_edit_description);
      thisObj.editDialog.find('#sgroups-hidden-name').html(firstRow.name);
      thisObj.editDialog.find('#sgroup-template').val('none');
      thisObj.editDialog.find('#sgroups-edit-group-desc').html(firstRow.description);
      thisObj.editDialog.find('input[id=allow-ip]').prop('disabled', false);
      thisObj.editDialog.find('input[id=allow-group]').prop('disabled', true);
      thisObj.editDialog.find('input[id=sgroup-allow-ip]').prop('checked', 'yes');
      thisObj.editDialog.find('#sgroup-more-rules').css('display','none')
      thisObj._refreshRulesList(thisObj.editDialog);
    },

    _expandCallback : function(row){ 
      var thisObj = this;
      var groupName = $(row[1]).html();
      var results = describe('sgroup');
      var group = null;
      for(i in results){
        if (results[i].name === groupName){
          group = results[i];
          break;
        }
      }
      if(!group || !group.rules || group.rules.length <= 0){
        return null;
      }
      var $wrapper = $('<div>').addClass('sgroup-table-expanded-group').addClass('clearfix').append(
          $('<div>').addClass('expanded-section-label').text(sgroup_table_expanded_title), 
          $('<div>').addClass('expanded-section-content').addClass('clearfix'));
      if(group.rules && group.rules.length > 0){
        var $list = $wrapper.find('div').last();
        $.each(group.rules, function (idx, rule){
          var protocol = rule['ip_protocol'];
          var port = rule['from_port'];
          if(rule['to_port'] !== rule['from_port'])
            port += '-'+rule['to_port']; 
          var type = '';
          if(protocol === 'icmp'){
            // TODO : define icmp type
            ;
          }
          var portOrType = type ? type: port;
          var portOrTypeTitle = type ? sgroup_table_expanded_type : sgroup_table_expanded_port;

          var src = [];
          var grants = rule['grants'];
          $.each(grants, function(idx, grant){
            if(grant.cidr_ip && grant.cidr_ip.length>0){
              src.push(grant.cidr_ip);
            }else if(grant.owner_id && grant.owner_id.length>0){
              if(group.owner_id === grant.owner_id)
                src.push(grant.groupName);
              else
                src.push(grant.owner_id+'/'+grant.groupName);
            }
          });
          src = src.join(', '); 
 
          $list.append(
            $('<div>').addClass('sgroup-expanded-rule').append(
              $('<div>').addClass('rule-label').text(sgroup_table_expanded_rule),
              $('<ul>').addClass('rule-expanded').addClass('clearfix').append(
                $('<li>').append( 
                  $('<div>').addClass('expanded-title').text(sgroup_table_expanded_protocol),
                  $('<div>').addClass('expanded-value').text(protocol)),
                $('<li>').append( 
                  $('<div>').addClass('expanded-title').text(portOrTypeTitle),
                  $('<div>').addClass('expanded-value').text(portOrType)),
                $('<li>').append( 
                  $('<div>').addClass('expanded-title').text(sgroup_table_expanded_source),
                  $('<div>').addClass('expanded-value').text(src)))));
        });
      }
      return $('<div>').append($wrapper);
    },

/**** Public Methods ****/
    close: function() {
   //   this.tableWrapper.eucatable('close');
      cancelRepeat(tableRefreshCallback);
      this._super('close');
    },

    dialogAddGroup : function(callback) {
      var thisObj = this;
      thisObj.rulesList=null; 
      $('#sgroup-rules-list').html(''); 
      if(callback)
        thisObj.addDialog.data('eucadialog').option('on_close', {callback: callback});
      thisObj.addDialog.eucadialog('open')
    },
/**** End of Public Methods ****/
  });
})(jQuery,
   window.eucalyptus ? window.eucalyptus : window.eucalyptus = {});
