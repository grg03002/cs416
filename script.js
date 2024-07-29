const width = 600;
const height = 400;
const margin = { top: 20, right: 70, bottom: 30, left: 60 };
const barWidth = width - margin.left - margin.right;
const barHeight = height - margin.top - margin.bottom;

async function createScatterPlot(containerId, data, region) {
  const filteredData = region ? data.filter(d => d.region === region) : data;

  const scatterData = d3.groups(filteredData, d => d.year).map(([year, values]) => {
    return {
      year: year,
      supply: +values.find(v => v.parameter === "EV stock")?.value || 0,
      demand: +values.find(v => v.parameter === "EV sales")?.value || 0
    };
  });

  let svg = d3.select(containerId).select("svg");

  if (svg.empty()) {
    svg = d3.select(containerId)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
  } else {
    svg.selectAll("*").remove();
  }

  const x = d3.scaleLinear()
    .domain([d3.min(scatterData, d => +d.year), d3.max(scatterData, d => +d.year)])
    .range([0, width - margin.left - margin.right]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(scatterData, d => Math.max(d.supply, d.demand))])
    .range([height - margin.top - margin.bottom, 0]);

  svg.append("g")
    .attr("transform", `translate(0,${height - margin.top - margin.bottom})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  svg.append("g")
    .call(d3.axisLeft(y));

  const tooltip = d3.select("#tooltip");

  svg.selectAll(".dot-supply")
    .data(scatterData)
    .enter()
    .append("circle")
    .attr("class", "dot-supply")
    .attr("cx", d => x(d.year))
    .attr("cy", d => y(d.supply))
    .attr("r", 5)
    .style("fill", "blue")
    .on("mouseover", function(event, d) {
      tooltip.transition().duration(200).style("opacity", 0.9);
      tooltip.html(`Year: ${d.year}<br>Supply: ${d.supply}`)
        .style("left", (event.pageX + 5) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      tooltip.transition().duration(500).style("opacity", 0);
    });

  svg.selectAll(".dot-demand")
    .data(scatterData)
    .enter()
    .append("circle")
    .attr("class", "dot-demand")
    .attr("cx", d => x(d.year))
    .attr("cy", d => y(d.demand))
    .attr("r", 5)
    .style("fill", "red")
    .on("mouseover", function(event, d) {
      tooltip.transition().duration(200).style("opacity", 0.9);
      tooltip.html(`Year: ${d.year}<br>Demand: ${d.demand}`)
        .style("left", (event.pageX + 5) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      tooltip.transition().duration(500).style("opacity", 0);
    });
}

async function createStackedBarChart(containerId, dataUrl) {
  const data = await d3.csv(dataUrl);
  const years = [...new Set(data.map(d => d.year))].sort((a, b) => a - b);

  const dropdownContainer = d3.select(containerId).append("div").attr("class", "dropdown-container");

  dropdownContainer.append("label").text("Year: ");
  const yearDropdown = dropdownContainer
    .append("select")
    .attr("id", "yearDropdown")
    .selectAll("option")
    .data(years)
    .enter()
    .append("option")
    .attr("value", d => d)
    .text(d => d);

  const svgContainer = d3.select(containerId)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand()
    .range([0, barWidth])
    .padding(0.1);

  const y = d3.scaleLinear()
    .range([barHeight, 0]);

  const color = d3.scaleOrdinal()
    .domain(["EV sales share", "EV stock share"])
    .range(d3.schemeCategory10);

  const tooltip = d3.select("#tooltip");

  function updateStackedBarChart(year) {
    const filteredData = data.filter(d => d.year === year);

    const groupedData = d3.groups(filteredData, d => d.region);

    const stackedData = d3.stack()
      .keys(["EV sales share", "EV stock share"])
      .value((d, key) => d[1].find(v => v.parameter === key)?.value || 0)(groupedData);

    x.domain(groupedData.map(d => d[0]));
    y.domain([0, d3.max(stackedData, d => d3.max(d, d => d[1]))]);

    const bars = svgContainer.selectAll(".bar-group")
      .data(stackedData);

    bars.exit().remove();

    const barGroups = bars.enter()
      .append("g")
      .attr("class", "bar-group")
      .attr("fill", d => color(d.key))
      .merge(bars);

    const rects = barGroups.selectAll("rect")
      .data(d => d);

    rects.exit().remove();

    rects.enter()
      .append("rect")
      .attr("x", d => x(d.data[0]))
      .attr("y", barHeight)
      .attr("height", 0)
      .attr("width", x.bandwidth())
      .on("mouseover", function(event, d) {
        tooltip.transition().duration(200).style("opacity", 0.9);
        tooltip.html(`Region: ${d.data[0]}<br>${d.data[1].map(v => `${v.parameter}: ${v.value}%`).join("<br>")}`)
          .style("left", (event.pageX + 5) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function() {
        tooltip.transition().duration(500).style("opacity", 0);
      })
      .merge(rects)
      .transition()
      .duration(750)
      .attr("x", d => x(d.data[0]))
      .attr("y", d => y(d[1]))
      .attr("height", d => y(d[0]) - y(d[1]))
      .attr("width", x.bandwidth());

    svgContainer.selectAll(".axis").remove();

    svgContainer.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${barHeight})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-0.8em")
      .attr("dy", "0.15em")
      .attr("transform", "rotate(-45)");

    svgContainer.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y));
  }

  d3.select("#yearDropdown").on("change", function() {
    const selectedYear = d3.select(this).property("value");
    updateStackedBarChart(selectedYear);
  });

  // Initial update with the first year
  const initialYear = years[0];
  d3.select("#yearDropdown").property("value", initialYear);
  updateStackedBarChart(initialYear);
}

function updateScatterPlot(containerId, data, region) {
  const filteredData = data.filter(d => d.region === region);

  const scatterData = d3.groups(filteredData, d => d.year).map(([year, values]) => {
    return {
      year: year,
      supply: +values.find(v => v.parameter === "EV stock")?.value || 0,
      demand: +values.find(v => v.parameter === "EV sales")?.value || 0
    };
  });

  let svg = d3.select(containerId).select("svg");

  if (svg.empty()) {
    svg = d3.select(containerId)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
  } else {
    svg.selectAll("*").remove();
  }

  const x = d3.scaleLinear()
    .domain([d3.min(scatterData, d => +d.year), d3.max(scatterData, d => +d.year)])
    .range([0, width - margin.left - margin.right]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(scatterData, d => Math.max(d.supply, d.demand))])
    .range([height - margin.top - margin.bottom, 0]);

  svg.append("g")
    .attr("transform", `translate(0,${height - margin.top - margin.bottom})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  svg.append("g")
    .call(d3.axisLeft(y));

  const tooltip = d3.select("#tooltip");

  svg.selectAll(".dot-supply")
    .data(scatterData)
    .enter()
    .append("circle")
    .attr("class", "dot-supply")
    .attr("cx", d => x(d.year))
    .attr("cy", d => y(d.supply))
    .attr("r", 5)
    .style("fill", "blue")
    .on("mouseover", function(event, d) {
      tooltip.transition().duration(200).style("opacity", 0.9);
      tooltip.html(`Year: ${d.year}<br>Supply: ${d.supply}`)
        .style("left", (event.pageX + 5) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      tooltip.transition().duration(500).style("opacity", 0);
    });

  svg.selectAll(".dot-demand")
    .data(scatterData)
    .enter()
    .append("circle")
    .attr("class", "dot-demand")
    .attr("cx", d => x(d.year))
    .attr("cy", d => y(d.demand))
    .attr("r", 5)
    .style("fill", "red")
    .on("mouseover", function(event, d) {
      tooltip.transition().duration(200).style("opacity", 0.9);
      tooltip.html(`Year: ${d.year}<br>Demand: ${d.demand}`)
        .style("left", (event.pageX + 5) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      tooltip.transition().duration(500).style("opacity", 0);
    });
}

async function createTreemap(containerId, dataUrl, year = null) {
  const data = await d3.csv(dataUrl);
  const years = [...new Set(data.map(d => d.year))].sort((a, b) => a - b);
  
  const dropdownContainer = d3.select(containerId).append("div").attr("class", "dropdown-container");

  dropdownContainer.append("label").text("Year: ");
  const yearDropdown = dropdownContainer
    .append("select")
    .attr("id", "treemapYearDropdown")
    .selectAll("option")
    .data(years)
    .enter()
    .append("option")
    .attr("value", d => d)
    .text(d => d);

  function updateTreemap(selectedYear) {
    const filteredData = data.filter(d => d.parameter === "Electricity demand" && d.year === selectedYear);
    
    const root = d3.hierarchy({ values: filteredData }, d => d.values)
      .sum(d => +d.value)
      .sort((a, b) => b.value - a.value);

    const treemapLayout = d3.treemap()
      .size([width, height])
      .padding(1);

    treemapLayout(root);

    let svg = d3.select(containerId).select("svg");

    if (svg.empty()) {
      svg = d3.select(containerId)
        .append("svg")
        .attr("width", width)
        .attr("height", height);
    } else {
      svg.selectAll("*").remove();
    }

    const nodes = svg.selectAll("g")
      .data(root.leaves())
      .enter()
      .append("g")
      .attr("transform", d => `translate(${d.x0},${d.y0})`);

    const tooltip = d3.select("#tooltip");

    nodes.append("rect")
      .attr("width", d => d.x1 - d.x0)
      .attr("height", d => d.y1 - d.y0)
      .style("fill", "lightblue")
      .style("stroke", "black")
      .on("mouseover", function(event, d) {
        tooltip.transition().duration(200).style("opacity", 0.9);
        tooltip.html(`Region: ${d.data.region}<br>Value: ${d.data.value}`)
          .style("left", (event.pageX + 5) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function() {
        tooltip.transition().duration(500).style("opacity", 0);
      });

    nodes.append("text")
      .attr("x", 5)
      .attr("y", 20)
      .text(d => d.data.region)
      .attr("font-size", "10px")
      .attr("fill", "black");
  }

  d3.select("#treemapYearDropdown").on("change", function() {
    const selectedYear = d3.select(this).property("value");
    updateTreemap(selectedYear);
  });

  const initialYear = years[0];
  d3.select("#treemapYearDropdown").property("value", initialYear);
  updateTreemap(initialYear);
}

document.addEventListener("DOMContentLoaded", async () => {
  const data = await d3.csv("data/full_data.csv");

  const regions = [...new Set(data.map(d => d.region))].sort();

  const dropdownContainer = d3.select("#dropdowns").append("div").attr("class", "dropdown-container");

  dropdownContainer.append("label").text("Region: ");
  dropdownContainer.append("select")
    .attr("id", "regionDropdown")
    .selectAll("option")
    .data(regions)
    .enter()
    .append("option")
    .attr("value", d => d)
    .text(d => d);

  await createScatterPlot("#chart1", data);
  await createStackedBarChart("#chart2", "data/full_data.csv");
  await createTreemap("#chart3", "data/full_data.csv");

  d3.select("#regionDropdown").on("change", function() {
    const selectedRegion = d3.select(this).property("value");
    updateScatterPlot("#chart1", data, selectedRegion);
  });

  const sections = document.querySelectorAll(".section");
  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const index = Array.from(sections).indexOf(entry.target);
        if (index === 1) {
          // Add any additional behavior if needed for the stacked bar chart section
        } else if (index === 2) {
          // Add any additional behavior if needed for the third chart section
        }
      }
    });
  }, { threshold: 0.5 });

  sections.forEach(section => {
    observer.observe(section);
  });
});
