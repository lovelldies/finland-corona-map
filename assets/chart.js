const casesAPI = 'https://w3qa5ydb4l.execute-api.eu-west-1.amazonaws.com/prod/finnishCoronaData/v2';
const hospitalsAPI = 'https://w3qa5ydb4l.execute-api.eu-west-1.amazonaws.com/prod/finnishCoronaHospitalData';

var casesApiResponse = '';
var hospitalsApiResponse = '';
var maxCount = 0;

const colors = {
  critical: '#ca0101',
  bad: '#e17a2d',
  medium: '#e1d92d',
  good: '#5dbe24',
  excellent: '#0b7d03',
};

const healthCareDistrictToArea = {
  'HUS': 'HYKS',
  'Pirkanmaa': 'TAYS',
  'Pohjois-Savo': 'KYS',
  'Pohjois-Pohjanmaa': 'OYS',
  'Varsinais-Suomi': 'TYKS',
};

function timestampToDate(timestamp) {
  return moment(timestamp).format('YYYY-MM-DD');
}

function read(response, field, healthCareDistrict) {
  const area = healthCareDistrictToArea[healthCareDistrict];

  if (!area) {
    return 0;
  }

  const hospital = _.chain(response).filter((item) => item.area === area).last().value();

  return hospital[field] || 0;
}

$.get(casesAPI, function(data) {
  casesApiResponse = data;
  $('#totalConfirmed').append(casesApiResponse.confirmed.length);
  $('#totalRecovered').append(casesApiResponse.recovered.length);
  $('#totalDeaths').append(casesApiResponse.deaths.length);
}).done(function() {

  $.get(hospitalsAPI, function(data) {
    hospitalsApiResponse = data.hospitalised;
    $('#hospitalised').append(hospitalsApiResponse[hospitalsApiResponse.length - 1].totalHospitalised);
    $('#inIcu').append(hospitalsApiResponse[hospitalsApiResponse.length - 1].inIcu);
  }).done(function() {

    am4core.ready(function() {
      var regionMap = {};

      $.getJSON('assets/fi.json', function(data) {
        regionMap = data;
      }).done(function() {

        am4core.useTheme(am4themes_animated);

        // HDC = Healthcare District.
        let allCasesGroupedByHCD = {
          confirmed: [], // These are the infected cases.
          deaths: [],
          recovered: []
        };

        /**
         * There are three keys: confirmed, recovered & deaths.
         * For each of these we need the date in the YYYY-MM-DD format
        */
        Object.keys(casesApiResponse).forEach(key => {
          casesApiResponse[key].forEach(item => {
            if (!item.healthCareDistrict) {
              item.healthCareDistrict = 'Not specified';
            }

            item.day = timestampToDate(item.date);
          });

          allCasesGroupedByHCD[key] = _.chain(casesApiResponse[key])
            .groupBy('healthCareDistrict')
            .map((value, key) => ({
              healthCareDistrict: key,
              cases: value,
              region: _.find(regionMap, ['healthCareDistrict', key])
            }))
            .value();
        });

        const confirmedGroupedByHealthCareDistrict = _.chain(casesApiResponse.confirmed)
          .groupBy('healthCareDistrict')
          .map((value, key) => ({
            healthCareDistrict: key,
            infectedCases: value,
            region: _.find(regionMap, ['healthCareDistrict', key])
          }))
          .value();

        const recoveredGroupedByHealthCareDistrict = _.chain(casesApiResponse.recovered)
          .groupBy('healthCareDistrict')
          .map((value, key) => ({
            healthCareDistrict: key,
            recoveredCases: value,
            region: _.find(regionMap, ['healthCareDistrict', key])
          }))
          .value();

        const deathsGroupedByHealthCareDistrict = _.chain(casesApiResponse.deaths)
          .groupBy('healthCareDistrict')
          .map((value, key) => ({
            healthCareDistrict: key,
            deathsCases: value,
            region: _.find(regionMap, ['healthCareDistrict', key])
          }))
          .value();

        let allGroupedByHealthCareDistrict = _.values(_.merge(
          _.keyBy(confirmedGroupedByHealthCareDistrict, 'healthCareDistrict'),
          _.keyBy(recoveredGroupedByHealthCareDistrict, 'healthCareDistrict'),
          _.keyBy(deathsGroupedByHealthCareDistrict, 'healthCareDistrict')
        ));

        allGroupedByHealthCareDistrict = _.orderBy(allGroupedByHealthCareDistrict, 'healthCareDistrict' , 'asc');

        const infectedGroupedByDate = _.chain(casesApiResponse.confirmed)
          .groupBy('day')
          .map((value, key) => ({
            date: key,
            infectedCases: value,
          }))
          .value();

        infectedGroupedByDate.forEach(item => {
          item.infectedTotal = item.infectedCases.length;
        });

        let recoveredGroupedByDate = _.chain(casesApiResponse.recovered)
          .groupBy('day')
          .map((value, key) => ({
            date: key,
            recoveredCases: value,
          }))
          .value();

        recoveredGroupedByDate.forEach(item => {
          item.recoveredTotal = item.recoveredCases.length;
        });

        let deathsGroupedByDate = _.chain(casesApiResponse.deaths)
          .groupBy('day')
          .map((value, key) => ({
            date: key,
            deathsCases: value,
          }))
          .value();

          deathsGroupedByDate.forEach(item => {
          item.deathsTotal = item.deathsCases.length;
        });

        let allGroupsByDate = _(recoveredGroupedByDate)
            .concat(infectedGroupedByDate)
            .concat(deathsGroupedByDate)
            .groupBy('date')
            .map(_.spread(_.merge))
            .value();

        allGroupsByDate = _.sortBy(allGroupsByDate, ['date']);

        infectedGroupedByDate.forEach(item => {
          item.total = item.infectedCases.length;
          // item[element.healthCareDistrict] = 1;

          const caseItem = _.chain(item.infectedCases)
          .groupBy('healthCareDistrict')
          .map((value, key) => ({
            healthCareDistrict: key,
            infectedCases: value,
            region: _.find(regionMap, ['healthCareDistrict', key])
          }))
          .value();

          caseItem.forEach(elem => {
            item[elem.healthCareDistrict] = elem.infectedCases.length;
          });
        });

        let tr = '';
        allGroupedByHealthCareDistrict.forEach(item => {
          if (!item.infectedCases) { item.infectedCases = []; }
          if (!item.recoveredCases) { item.recoveredCases = []; }
          if (!item.deathsCases) { item.deathsCases = []; }

          item.hospitalised = read(hospitalsApiResponse, 'totalHospitalised', item.healthCareDistrict);
          item.inICU = read(hospitalsApiResponse, 'inIcu', item.healthCareDistrict);
          item.deaths = read(hospitalsApiResponse, 'dead', item.healthCareDistrict);

          tr += `<tr>
            <td>${item.infectedCases.length}</td>
            <td>${item.recoveredCases.length}</td>
            <td>${item.deaths}</td>
            <td>${item.hospitalised}</td>
            <td>${item.inICU}</td>
            <td>${item.healthCareDistrict}</td>
          </tr>`;
        });
        $('#dataTableBody').append(tr);

        // var title = 'Coronavirus disease (COVID-19) outbreak in Finland';
        // Create map instance
        var chart = am4core.create('mapDiv', am4maps.MapChart);
        // chart.titles.create().text = title;
        chart.tapToActivate = true;
        chart.chartContainer.wheelable = false;

        // var button = chart.chartContainer.createChild(am4core.Button);
        // button.label.text = 'home';
        // button.padding(5, 5, 5, 5);
        // button.width = 20;
        // button.align = 'right';
        // button.marginRight = 15;
        // button.events.on('hit', function() {
        //   chart.goHome();
        // });


        // chart.seriesContainer.draggable = false;
        // chart.seriesContainer.resizable = false;
        // chart.maxZoomLevel = 1;

        // Set map definition
        chart.geodataSource.url = 'assets/finlandLow.json';
        chart.geodataSource.events.on('parseended', function(ev) {
          var data = [];

          for(var i = 0; i < ev.target.data.features.length; i++) {
            const id = ev.target.data.features[i].id;

            let count = 0;
            let recoveredCount = 0;
            let deathsCount = 0;

            let percentage = 0;
            selected = true;

            if (_.find(confirmedGroupedByHealthCareDistrict, { region: {id: id}})) {
              const rx = _.find(confirmedGroupedByHealthCareDistrict, { region: {id: id}});
              count = rx.infectedCases.length;
              recoveredCount = rx.recoveredCases.length;
              deathsCount = rx.deathsCases.length;

              selected = false;
              percentage = (count/casesApiResponse.confirmed.length) * 100;

              if (rx.region.geo) {
                latitude = rx.region.geo.lat;
                longitude = rx.region.geo.long
              } else {
                latitude = null;
                longitude = null;
              }

              data.push({
                id: ev.target.data.features[i].id,
                count: count,
                recoveredCount: recoveredCount,
                deathsCount: deathsCount,
                selected: selected,
                latitude: latitude,
                longitude: longitude,
                percentage: percentage
              });
            } else {
              data.push({
                id: ev.target.data.features[i].id,
                count: count,
                recoveredCount: recoveredCount,
                deathsCount: deathsCount,
                value: count,
                selected: selected,
                // latitude: latitude,
                // longitude: latitude,
                percentage: percentage
              });
            }


          }

          var maxCount = _.maxBy(data, 'count').count;

          data.forEach(item => {
            // let val = (item.count/maxCount) * 100;
            let val = item.count;

            if (val >= 100) {
              item.color = 'critical';
            }
             if (100 > val && val >= 25) {
              item.color = 'bad';
            }
             if (25 > val && val >= 10) {
              item.color = 'medium';
            }
             if (10 > val && val >= 1) {
              item.color = 'good';
            }
             if (1 > val) {
              item.color = 'excellent';
            }

            // item.cases = _.find(allGroupedByHealthCareDistrict, ['region.id', item.id]);
          });

          polygonSeries.data = data;

          // Create image series
          var imageSeries = chart.series.push(new am4maps.MapImageSeries());

          // Create a circle image in image series template so it gets replicated to all new images
          var imageSeriesTemplate = imageSeries.mapImages.template;
          var circle = imageSeriesTemplate.createChild(am4core.Circle);
          circle.radius = 15;
          circle.fill = am4core.color('#fff');
          circle.fillOpacity = 0.3;
          circle.stroke = am4core.color('#000');
          circle.strokeWidth = 2;
          circle.nonScaling = true;
          // circle.tooltipText = '{name}\n[bold]{count}[/]';
          // circle.alwaysShowTooltip = true;
          // circle.tooltipText = '{name}\n Infected: [bold]{count}[/]';
          // circle.showTooltipOn = 'always';
          circle.tooltipHTML = `<center><strong>{name}</strong></center>
            <br>
            <table>
            <tr>
              <td align="left">Infected</td>
              <th class="pl-2 text-warning">{count}</td>
            </tr>
            <tr>
              <td align="left">Recovered</td>
              <th class="pl-2 text-success">{recoveredCount}</th>
            </tr>
            <tr>
              <td align="left">Deaths</td>
              <th class="pl-2 text-danger">{deathsCount}</th>
            </tr>
            </table>`;


          var label = imageSeriesTemplate.createChild(am4core.Label);
          label.text = '{count}';
          label.fill = am4core.color('#000');
          label.zIndex = 1;
          label.fontSize = 11;
          label.interactionsEnabled = false;
          label.x = am4core.percent(50);
          label.horizontalCenter = 'middle';
          label.y = am4core.percent(50);
          label.verticalCenter = 'middle';

          // Add data for the three cities
          imageSeries.data = polygonSeries.data;

          // Set property fields
          imageSeriesTemplate.propertyFields.latitude = 'latitude';
          imageSeriesTemplate.propertyFields.longitude = 'longitude';
        })

        // Set projection
        chart.projection = new am4maps.projections.Mercator();

        // Create map polygon series
        var polygonSeries = chart.series.push(new am4maps.MapPolygonSeries());
        // polygonSeries.calculateVisualCenter = true;

        //Set min/max fill color for each area
        polygonSeries.heatRules.push({
          property: 'fill',
          target: polygonSeries.mapPolygons.template,
        });

        // Make map load polygon data (state shapes and names) from GeoJSON
        polygonSeries.useGeodata = true;

        // Configure series tooltip
        var polygonTemplate = polygonSeries.mapPolygons.template;
        // polygonTemplate.tooltipText = '{name}: {count}';
        // polygonTemplate.nonScalingStroke = true;
        // polygonTemplate.strokeWidth = 0.5;
        // polygonTemplate.fill = am4core.color('{color}');


        polygonTemplate.adapter.add('fill', function(fill, target) {
          if (target.dataItem.dataContext && target.dataItem.dataContext.selected) {
            return am4core.color(colors.excellent);
          }
          if (target.dataItem.dataContext) {
            return am4core.color(colors[target.dataItem.dataContext.color]);
          }

          return fill;
        });

        // // Create hover state and set alternative fill color
        // var hs = polygonTemplate.states.create('hover');
        // hs.properties.fill = chart.colors.getIndex(1).brighten(-0.5);

        createStackedBarChart('hcdStackedBarChart', infectedGroupedByDate);
        createStackedBarChart('allGroupsStackedBarChart', allGroupsByDate);
      });


      function createStackedBarChart(id, data) {
        const stackedBarChart = am4core.create(id, am4charts.XYChart);
        stackedBarChart.data = data;

        // Create axes
        var categoryAxis = stackedBarChart.xAxes.push(new am4charts.CategoryAxis());
        categoryAxis.dataFields.category = 'date';
        categoryAxis.title.text = 'Date';
        categoryAxis.renderer.grid.template.location = 0;
        // categoryAxis.renderer.grid.template.strokeOpacity = 0.25;
        categoryAxis.renderer.minGridDistance = 20;
        categoryAxis.renderer.cellStartLocation = 0.1;
        categoryAxis.renderer.cellEndLocation = 0.9;
        categoryAxis.renderer.labels.template.horizontalCenter = 'right';
        categoryAxis.renderer.labels.template.verticalCenter = 'middle';
        categoryAxis.renderer.labels.template.rotation = 90;

        var valueAxis = stackedBarChart.yAxes.push(new am4charts.ValueAxis());
        valueAxis.min = 0;

        // Create series
        function createSeries(field, name, stacked, color) {
          var series = stackedBarChart.series.push(new am4charts.ColumnSeries());
          series.dataFields.valueY = field;
          series.dataFields.categoryX = 'date';
          series.name = name;
          series.columns.template.tooltipText = '{name}: [bold]{valueY}[/]';
          series.stacked = stacked;
          series.columns.template.width = am4core.percent(95);
          series.strokeWidth = 0;

          if (color) {
            series.fill = am4core.color(color);
          }
        }


        switch (id) {
          case 'allGroupsStackedBarChart':
            valueAxis.title.text = 'Number of cases';

            createSeries('infectedTotal', 'Infected', false, colors.medium);
            createSeries('recoveredTotal', 'Recovered', false, colors.good);
            createSeries('deathsTotal', 'Deaths', false, colors.critical);
            break;

          case 'hcdStackedBarChart':
            valueAxis.title.text = 'Confirmed number of infections';

            regionMap.forEach(element => {
                const hcd = element.healthCareDistrict;
                createSeries(hcd, hcd, true);
              });
            break;
          default:
            break;
        }

        // Add legend
        stackedBarChart.legend = new am4charts.Legend();
      }
    }); // end am4core.ready()
  });
});
