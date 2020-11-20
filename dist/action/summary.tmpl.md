### <img src="<%=helpers.icons.LIGHTSTEP_ICON%>" height="20px" alt="Lightstep Logo"/> Lightstep Services Change Report
<% if (snapshotCompare) {%>Comparing topology, latency and errors of services between snapshots [`<%=snapshotBeforeId%>`](<%=helpers.snapshotLink(lightstepProj, snapshotBeforeId)%>) and [`<%=snapshotAfterId%>`](<%=helpers.snapshotLink(lightstepProj, snapshotAfterId)%>)
> `<%= newServicesCount %>` new service(s) detected
<% } else { %>>Topology, latency and errors summary for snapshot [`<%=snapshotBeforeId%>`](<%=helpers.snapshotLink(lightstepProj, snapshotBeforeId)%>)<% }%>
<%= table %>

<% if (integrations.rollbar) {%>#### <img src="<%=helpers.icons.ROLLBAR_ICON%>" height="14px" alt="Rollbar Logo"/> Errors
> <%= helpers.rollbarVersionErrors(integrations.rollbar) %><% }%>
