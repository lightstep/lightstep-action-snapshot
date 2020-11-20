<!-- Lightstep Service Dependency Table -->
<table>
  <thead>
     <tr><th>Service</th><th>Average Latency</th><th>Error %</th><% if (integrations.pagerduty) {%><th><img src="<%=helpers.icons.PAGERDUTY_ICON%>" height="14px" alt="PagerDuty Logo"/>&nbsp;On-Call</th><%}%></tr>
  </thead>
  <tbody><%for (var s of inputTable) {%>
    <!-- Service Row -->
     <tr>
      <td><% if (s.new_service) { %>:new:&nbsp;<%}%><a target="_blank" href="https://app.lightstep.com/<%=lightstepProj%>/service-directory/<%= s.service %>/deployments"><%=s.service%></a></td>
      <td><%= helpers.latencyFormatter(s) %></td>
      <td><%=helpers.percentFormatter(s)%></td><% if (integrations.pagerduty) {%><td align="center"><%= helpers.parseOnCall(s.pagerduty) %></td><%}%></tr>
    <!-- Service Detail Row -->
    <tr>
       <td>&nbsp;</td>
       <td colspan=3><% if (s.violations && s.violations.length > 0) { %>
          <p><details>
             <summary>:warning: Violations</summary>
             <ul><% for (v of s.violations) { %>
                <li><b><%=helpers.snapshotFilterLink(v.msg, lightstepProj, snapshotAfterId, s.service, v.violation.key)%></b></li><% } %>
             </ul>
          </details></p><% } %><% if (s.snapshot.dependencies) { %>
          <p><details>
             <summary>:arrow_down_small: Downstream Dependencies</summary>
             <ul><% for (serviceDep in s.snapshot.dependencies) { %>
                <li><% if (serviceDep.new_connection) { %>:new:&nbsp;<%}%><a target="_blank" href="https://app.lightstep.com/<%=lightstepProj%>/service-directory/<%= s.service %>/deployments"><%=serviceDep%></a></li><% } %>
             </ul>
          </details></p>
          <% } %><p><details>
            <summary>:gear: Service Operations</summary>
            <ul><% for (op in s.snapshot.operations) { %>
               <li><code><%= helpers.snapshotOperationLink(lightstepProj, snapshotAfterId, s.service, op) %></code></li><% } %>
            </ul>
          </details></p>
         <p><details>
             <summary>🕵️‍♀️ What caused that change?</summary>
               <ul>
                  <li>
                     <p>Snapshot<a href="<%=helpers.snapshotLink(lightstepProj, snapshotBeforeId)%>"><code><%=snapshotBeforeId%></code></a></p>
                     <ul>
                        <li><%=helpers.snapshotFilterLink(':octocat: View traces by GitHub SHA', lightstepProj, snapshotBeforeId, s.service, 'github.sha')%></li>
                        <% if (integrations.rollbar) {%><li><%=helpers.snapshotFilterLink(`<img src="${helpers.icons.ROLLBAR_ICON}" height="14px" alt="Rollbar Logo"/> View traces by Rollbar error`, lightstepProj, snapshotBeforeId, s.service, 'rollbar.error_uuid')%></li><% } %>
                        <!--<li><%=helpers.snapshotFilterLink(':monkey: View traces by Gremlin attack', lightstepProj, snapshotBeforeId, s.service, 'gremlin.attacks')%></li>
                        <li><%=helpers.snapshotFilterLink(':flags: View traces by feature flag', lightstepProj, snapshotBeforeId, s.service, 'launchdarkly.flags')%></li>-->
                     </ul>
                  </li><% if (snapshotCompare) {%>
                  <li><p>Snapshot<a href="<%=helpers.snapshotLink(lightstepProj, snapshotAfterId)%>"><code><%=snapshotAfterId%></code></a></p>
                     <ul>
                        <li><%=helpers.snapshotFilterLink(':octocat: View traces by GitHub SHA', lightstepProj, snapshotAfterId, s.service, 'github.sha')%></li>
                        <% if (integrations.rollbar) {%><li><%=helpers.snapshotFilterLink(`<img src="${helpers.icons.ROLLBAR_ICON}" height="14px" alt="Rollbar Logo"/> View traces by Rollbar error`, lightstepProj, snapshotBeforeId, s.service, 'rollbar.error_uuid')%></li><% } %>
                        <!--<li><%=helpers.snapshotFilterLink(':monkey: View traces by Gremlin attack', lightstepProj, snapshotAfterId, s.service, 'gremlin.attacks')%></li>
                        <li><%=helpers.snapshotFilterLink(':flags: View traces by feature flag', lightstepProj, snapshotAfterId, s.service, 'launchdarkly.flags')%></li>-->
                     </ul>
                  </li><% } %>
               </ul>
            </details>
          </details></p><% if (helpers.parseOnCall(s.pagerduty) === ':question:') { %>
          <p><details>
             <summary>🗒️ Recommendations</summary>
             <ul>
                <li>:pager:&nbsp;<b>No on-call information found.</b>&nbsp;Add a PagerDuty service to <code>.lightstep.yml</code> to see on-call information for this service.</li>
             </ul>
          </details></p><% } %>
       </td>
    </tr><%}%></tbody>
</table>
