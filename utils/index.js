function searchParamsToObj(searchParams) {
  const paramObj = {}

  searchParams.forEach((value, key) => {
    paramObj[key] = value
  })

  return paramObj
}

module.exports = {
  searchParamsToObj,
}
